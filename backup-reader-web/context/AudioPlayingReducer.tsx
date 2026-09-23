export interface AudioPlayingState {
  playing: any | null;
  status: "playing" | "pause" | null;
}

type AudioPlayingAction =
  | { type: "playAudio"; payload: any }
  | { type: "stopAudio" };

export const audioPlayingReducer = (
  state: AudioPlayingState,
  action: AudioPlayingAction
): AudioPlayingState => {
  switch (action.type) {
    case "playAudio":
      return {
        ...state,
        status: "playing",
        playing: action.payload,
      };
    case "stopAudio":
      return {
        ...state,
        status: "pause",
      };

    default:
      return state;
  }
};
