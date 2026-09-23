import { FC, useEffect, useContext, useState } from "react";
import { Image } from "@nextui-org/react";
import "yet-another-react-lightbox/styles.css";
import Lightbox from "yet-another-react-lightbox";
import { StorageContext } from "../../context/StorageContext";

type ChatImageProps = {
  message: string | null;
};

export const ChatImage: FC<ChatImageProps> = ({ message }) => {
  const [imageUrl, setImageUrl] = useState<string>();
  const [showImageViewer, setShowImageViewer] = useState<boolean>(false);

  const { file } = useContext(StorageContext);

  useEffect(() => {
    if(message){
      setImageUrl(message);
    }
  }, []);

  const onHandleShowImage = () => {
    setShowImageViewer(true);
  };
  return (
    <>
      {imageUrl && (
        <>
          <Lightbox
            open={showImageViewer}
            close={() => setShowImageViewer(false)}
            slides={[
              {
                src: imageUrl ? imageUrl : "",
              },
            ]}
          />
          <Image
            onClick={onHandleShowImage}
            style={{ width: "100%", maxWidth: "100%", height: 200, borderRadius: 8, cursor: "pointer" }}
            src={imageUrl}
            objectFit="cover"
            alt="Chat Image"
            autoResize
          />
        </>
      )}
    </>
  );
};
