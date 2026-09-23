import { createContext, useReducer } from "react";

import { audioPlayingReducer } from ".";
import { AudioPlayingState } from "./AudioPlayingReducer";

type AudioPlayingContextProps = {
  playing: any | null;
  status: "playing" | "pause" | null;
  onHandlePlayAudio: (audio: any) => void;
  onHandleStopAudio: (audio: any) => void;
};

export const audioPlayingInitialState: AudioPlayingState = {
  playing: null,
  status: null,
};

export const AudioPlayingContext = createContext(
  {} as AudioPlayingContextProps
);

export const AudioPlayingProvider = ({ children }: any) => {
  const [state, dispatch] = useReducer(
    audioPlayingReducer,
    audioPlayingInitialState
  );

  const onHandlePlayAudio = (audio: any) => {
    if (audio) {
      if (state.playing) {
        if (state.playing != audio) {
          state.playing.pause();
          dispatch({
            type: "playAudio",
            payload: audio,
          });
        }
      }
      
      audio.play().then(() => {
        console.log('Audio is successfully playing.')
      }).catch((error: Error) => {
        console.error("Error attempting to play audio: ", error);
      });
      
      dispatch({
        type: "playAudio",
        payload: audio,
      });
    }
  };

  const onHandleStopAudio = (audio: any) => {
    if (audio) {
      audio.pause();
      dispatch({
        type: "stopAudio",
      });
      if (state.playing) {
        state.playing.pause();
        if (state.playing != audio) {
          onHandlePlayAudio(audio);
        }
      }
    }
  };

  return (
    <AudioPlayingContext.Provider
      value={{
        ...state,
        onHandlePlayAudio,
        onHandleStopAudio,
      }}
    >
      {children}
    </AudioPlayingContext.Provider>
  );
};
