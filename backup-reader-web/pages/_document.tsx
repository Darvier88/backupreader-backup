import React from "react";
import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
} from "next/document";
import Script from 'next/script';
import { CssBaseline } from "@nextui-org/react";

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      styles: React.Children.toArray([initialProps.styles]),
    };
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {CssBaseline.flush()}

          {/*
            Iconos. No había NINGUNA etiqueta de icono en el proyecto: el
            navegador solo cogía /favicon.ico por convención, y Google ni eso,
            porque para el icono de los resultados de búsqueda exige que se
            declare con rel="icon" y que la imagen sea un cuadrado múltiplo de
            48. De ahí el PNG de 48.

            Van aquí, en _document, y no en el <Head> de Layout, porque son los
            mismos para todas las páginas y esto se renderiza una sola vez.

            El SVG primero: los navegadores que lo entienden lo prefieren y se
            ve nítido en cualquier densidad de pantalla. El .ico queda de
            respaldo y lleva 16, 32 y 48 dentro.

            Los archivos vienen del set de diseño, no se generan aquí: los PNG
            pequeños están ajustados a mano para su tamaño, y rasterizarlos de
            nuevo desde el SVG los empeoraría.
          */}
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="/favicon-64.png" type="image/png" sizes="64x64" />
          <link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48" />
          <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
          <link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16" />
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
          <link rel="manifest" href="/site.webmanifest" />
          {/* El azul tinta de la marca, igual que theme_color del manifiesto:
              es lo que tiñe la barra del navegador en móvil. */}
          <meta name="theme-color" content="#16233B" />

          <link
            href="https://fonts.googleapis.com/css2?family=PT+Serif&display=swap"
            rel="stylesheet"
          ></link>
          <link
            href="https://fonts.googleapis.com/css2?family=Open+Sans&display=swap"
            rel="stylesheet"
          ></link>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
            rel="stylesheet"
          ></link>

        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
