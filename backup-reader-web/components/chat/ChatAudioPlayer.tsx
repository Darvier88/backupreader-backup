import { FC, useContext, useEffect, useState } from "react";

import { Container } from "@nextui-org/react";
import PauseIcon from "@mui/icons-material/Pause";
import { IconButton, Slider } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import { AudioPlayingContext } from "../../context";
import { StorageContext } from "../../context/StorageContext";


const styles = {
  container: { display: "flex", alignItems: "center", width: "100%", maxWidth: "100%" },
};

type ChatAudioPlayerProps = {
  message: string | null;
};

export const ChatAudioPlayer: FC<ChatAudioPlayerProps> = ({ message }) => {
  const [audioTime, setAudioTime] = useState<number>(0);
  const [audioState, setAudioState] = useState<any>(null);
  const [audioButton, setAudioButton] = useState<boolean>(false);
  const { file } = useContext(StorageContext);
  const { onHandlePlayAudio, onHandleStopAudio, status } =

    useContext(AudioPlayingContext);

    useEffect(() => {
      if (!message) return;
      const audio = new Audio();
      audio.src = message;
      setAudioState(audio);
    }, []);
    

  const onHandleClick = () => {
    if (status === "pause" || status === null) {
      onHandlePlayAudio(audioState);
    } else {
      onHandleStopAudio(audioState);
    }
  };

  audioState?.addEventListener("play", () => {
    setAudioButton(true);
  });

  audioState?.addEventListener("pause", () => {
    setAudioButton(false);
  });

  audioState?.addEventListener("timeupdate", () => {
    const currentTime = Number.parseInt(audioState.currentTime);
    setAudioTime(currentTime);
    if (audioState.ended) {
      setAudioTime(0);
    }
  });

  return (
    <div
      style={{
        ...styles.container,
        flexDirection: "row",
      }}
    >
      <IconButton
        onClick={onHandleClick}
        aria-label="play"
        size="small"
        style={{ border: "1px solid #cfd8dc" }}
      >
        {audioButton ? (
          <PauseIcon style={{ fontSize: 25, color: "#0F52BA" }} />
        ) : (
          <PlayArrowIcon style={{ fontSize: 25, color: "#0F52BA" }} />
        )}
      </IconButton>
      <Container style={{ width: "100%", flex: 1 }}>
        <Slider
          value={audioTime}
          max={100}
          size="small"
          style={{ marginTop: 5, color: "#0F52BA" }}
          aria-label="progress"
          disabled
        />
      </Container>
    </div>
  );
};
