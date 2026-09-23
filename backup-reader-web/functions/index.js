// ============================================================================
//  functions/index.js  —  versión optimizada
//  ----------------------------------------------------------------------------
//  Qué se mejoró respecto del original:
//
//  1. SUBIDA DE ARCHIVOS EXTRAÍDOS POR STREAMING (bucket.upload) en vez de
//     fs.readFileSync + file.save(). Antes cada archivo (incluidos videos
//     grandes) se cargaba ENTERO en memoria; con backups pesados eso agota
//     la RAM de la función y la vuelve lenta o la mata. Ahora se sube desde
//     disco en streaming y con resumable=true para archivos grandes.
//
//  2. CONCURRENCIA LIMITADA (pLimit). El original hacía Promise.all sobre TODOS
//     los archivos a la vez -> picos de memoria/CPU. Ahora se procesan en lotes
//     controlados (por defecto 4 en paralelo), estable y más rápido en la práctica.
//
//  3. CONVERSIÓN opus -> mp3 también con concurrencia limitada (ffmpeg es
//     CPU-bound; lanzar decenas a la vez satura la función).
//
//  4. fs.rmSync en lugar de fs.rmdirSync (deprecado en Node 18+).
//
//  5. Descarga del ZIP a disco temporal en vez de a memoria (para ZIP grandes).
//
//  6. `mime` ya no es imprescindible aquí (se calcula el content-type por
//     extensión), pero si lo seguís usando en otro lado, decláralo en
//     functions/package.json (ver nota al final).
//
//  Requiere agregar la dependencia:  "p-limit": "^3.1.0"  (v3 = CommonJS)
// ============================================================================

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const AdmZip = require("adm-zip");
const os = require("os");
const fs = require("fs");
const path = require("path");
const cors = require("cors")({ origin: true });
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const pLimit = require("p-limit");

admin.initializeApp();
const storage = admin.storage();
ffmpeg.setFfmpegPath(ffmpegStatic);

const runtimeOpts = {
  timeoutSeconds: 540,
  memory: "2GB",
};

// Cuántas operaciones de subida / conversión correr en paralelo.
const UPLOAD_CONCURRENCY = 4;
const CONVERT_CONCURRENCY = 2;

const VIDEO_MIME = {
  ".mp4": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".mkv": "video/x-matroska",
};

const AUDIO_MIME = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".opus": "audio/ogg; codecs=opus",
};

const TEXT_TYPES = new Set([
  ".txt",
  ".json",
  ".csv",
  ".xml",
  ".html",
  ".css",
  ".js",
]);

const shouldGzip = (filename) => TEXT_TYPES.has(path.extname(filename).toLowerCase());

const contentTypeFor = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_MIME[ext] || AUDIO_MIME[ext] || undefined;
};

function convertOpusToMp3(opusPath, mp3Path) {
  return new Promise((resolve, reject) => {
    ffmpeg(opusPath)
      .toFormat("mp3")
      .output(mp3Path)
      .on("end", () => resolve(mp3Path))
      .on("error", (err) => reject(err))
      .run();
  });
}

function extractUserID(fullPath) {
  const parts = fullPath.split("/");
  const i = parts.indexOf("backups");
  return i !== -1 && i + 1 < parts.length ? parts[i + 1] : "User ID not found";
}

// Recorre el árbol extraído y devuelve la lista plana de archivos locales
// junto con su ruta destino en GCS.
function walk(dir, prefix, out = []) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const gcsPath = `${prefix}/${item}`;
    if (fs.statSync(full).isDirectory()) {
      walk(full, gcsPath, out);
    } else {
      out.push({ localPath: full, gcsPath, name: item });
    }
  }
  return out;
}

exports.unzip = functions
  .runWith(runtimeOpts)
  .storage.object()
  .onFinalize(async (object) => {
    if (object.contentType !== "application/zip") {
      console.warn("Content-type inválido:", object.contentType);
      return null;
    }

    const bucket = storage.bucket(object.bucket);
    const remoteFile = bucket.file(object.name);
    const db = admin.firestore();

    const tmpZipPath = path.join(os.tmpdir(), path.basename(object.name));
    const tempExtractDir = path.join(os.tmpdir(), "temp-extract-dir");

    try {
      // 1. Descargar el ZIP a disco (no a memoria) — mejor para archivos grandes.
      await remoteFile.download({ destination: tmpZipPath });

      // 2. Extraer.
      const zip = new AdmZip(tmpZipPath);
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      zip.extractAllTo(tempExtractDir, /* overwrite */ true);

      const nameWithoutZip = remoteFile.name.replace(".zip", "");
      const fileDate = new Date().toLocaleDateString("en-us", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
      });

      let finalFileName;
      if (remoteFile.name.includes("instagram")) {
        finalFileName = `${nameWithoutZip.replace("Instagram - ", "IG - ")} ${fileDate}`;
      } else {
        finalFileName = `${nameWithoutZip.replace("WhatsApp Chat - ", "")} ${fileDate}`;
      }

      // 3. Convertir todos los .opus a .mp3 con concurrencia limitada.
      const convertLimit = pLimit(CONVERT_CONCURRENCY);
      const allFiles = walk(tempExtractDir, finalFileName);

      await Promise.all(
        allFiles
          .filter((f) => path.extname(f.name).toLowerCase() === ".opus")
          .map((f) =>
            convertLimit(async () => {
              const mp3Local = f.localPath.replace(/\.opus$/i, ".mp3");
              try {
                await convertOpusToMp3(f.localPath, mp3Local);
                // Reemplazar la entrada opus por la mp3 en la lista.
                f.localPath = mp3Local;
                f.name = path.basename(mp3Local);
                f.gcsPath = f.gcsPath.replace(/\.opus$/i, ".mp3");
              } catch (err) {
                console.error("Error convirtiendo opus:", f.name, err);
                f.skip = true; // no subir el que falló
              }
            })
          )
      );

      // 4. Subir todo por streaming, con concurrencia limitada.
      const uploadLimit = pLimit(UPLOAD_CONCURRENCY);
      await Promise.all(
        allFiles
          .filter((f) => !f.skip)
          .map((f) =>
            uploadLimit(async () => {
              const ct = contentTypeFor(f.name);
              await bucket.upload(f.localPath, {
                destination: f.gcsPath,
                gzip: shouldGzip(f.name),
                resumable: true, // seguro para archivos grandes (videos)
                metadata: ct ? { contentType: ct } : undefined,
              });
            })
          )
      );

      // 5. Marcar estado en Firestore.
      const userID = extractUserID(remoteFile.name);
      await db.collection("userStatus").doc(userID).set({
        status: finalFileName,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 6. Limpieza.
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      fs.rmSync(tmpZipPath, { force: true });
      await remoteFile.delete();

      console.log("Backup procesado correctamente:", finalFileName);
      return null;
    } catch (error) {
      console.error("Error procesando el archivo:", error);
      // Limpieza defensiva.
      try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (_) {}
      try { fs.rmSync(tmpZipPath, { force: true }); } catch (_) {}
      throw error;
    }
  });

// ----------------------------------------------------------------------------
// Añadir Accept-Ranges a videos (sin cambios de lógica, limpiado).
// ----------------------------------------------------------------------------
exports.addAcceptRangesHeader = functions.storage
  .bucket("backup-reader.appspot.com")
  .object()
  .onMetadataUpdate(async (object) => {
    const m = object.metadata || {};
    const isVideo =
      (object.contentType && object.contentType.startsWith("video/")) ||
      (object.name && /\.(mp4|mov|avi|mkv)$/i.test(object.name));

    if (!isVideo) return null;

    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(object.name);
    await file.setMetadata({ metadata: { "Accept-Ranges": "bytes" } });
    console.log(`Accept-Ranges agregado a ${object.name}`);
    return null;
  });

// ----------------------------------------------------------------------------
// Stream de video (sin cambios de lógica).
// ----------------------------------------------------------------------------
exports.serveVideo = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    const bucketName = req.query.bucketName;
    const videoUrl = req.query.videoUrl;
    if (!bucketName || !videoUrl) return res.status(400).send("Bad Request");

    res.set("Content-Type", "video/mp4");
    res.set("Accept-Ranges", "bytes");

    const fileName = videoUrl.substring(videoUrl.lastIndexOf("/") + 1);
    const file = storage.bucket(bucketName).file(fileName);

    file
      .createReadStream()
      .on("error", (err) => {
        console.error("Error streaming video:", err);
        res.status(500).send("Error streaming video");
      })
      .pipe(res);
  });
});

// ----------------------------------------------------------------------------
// Cálculo de tamaño de carpeta del usuario (paginado, para muchos archivos).
// ----------------------------------------------------------------------------
exports.bucketSizeFunction = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const bucketName = req.query.bucketName;
    const folderPath = req.query.folderPath;
    try {
      const bucket = admin.storage().bucket(bucketName);
      const [files] = await bucket.getFiles({ prefix: folderPath });
      let total = 0;
      for (const f of files) total += Number(f.metadata.size || 0);
      res.json({ size: total / (1024 * 1024) });
    } catch (error) {
      console.error("Error calculando tamaño:", error);
      res.status(500).send("Error calculating bucket size");
    }
  });
});