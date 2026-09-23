import { FC, useContext, useEffect, useState } from "react";

import { Player } from "video-react";
import "video-react/dist/video-react.css";

type ChatVideoPlayerProps = {
  message: string | null;
};

export const ChatVideoPlayer: FC<ChatVideoPlayerProps> = ({ message }) => {
  const [videoUrl, setVideoUrl] = useState<string>();

  useEffect(() => {
    if(message){
      setVideoUrl(message);
    }
  }, []);

  return (
    <>
      {videoUrl && (
        <>
          <Player>
            <source
              src={videoUrl}
            />
          </Player>
        </>
      )}
    </>
  );
};