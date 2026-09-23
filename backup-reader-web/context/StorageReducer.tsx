import { FileList, FileDetail, Chat } from "../models/Files";

export interface StorageState {
  progress: number;
  chat: Chat[] | null;
  errorMessage: string;
  fileName: string | null;
  chatName: string | null;
  fullPath: string | null;
  assetUrl: string | null;
  file: FileDetail[] | null;
  fileList: FileList[] | null;
  recentFileName: string | null;
  uploadStatus: "saving" | "saved" | "not-saved" | null;
  downloadFileStatus: "downloading" | "downloaded" | "not-downloaded" | null;
  downloadFilesStatus: "downloading" | "downloaded" | "not-downloaded" | null;
}

type StorageAction =
  | { type: "loadingFile" }
  | { type: "removeError" }
  | { type: "downloadingFile" }
  | { type: "downloadingFiles" }
  | { type: "downloadingReset" }
  | { type: "setProgress"; payload: number }
  | { type: "uploadingError"; payload: string }
  | { type: "chatFile"; payload: Chat[] | null }
  | { type: "setChatName"; payload: string | null }
  | { type: "setFullPath"; payload: string | null }
  | { type: "setAssetUrl"; payload: string | null }
  | { type: "downloadingFileError"; payload: string }
  | { type: "downloadingFilesError"; payload: string }
  | { type: "setRecentFileName"; payload: string | null }
  | { type: "fileDownloaded"; payload: { file: FileDetail[] } }
  | { type: "fileListDownloaded"; payload: { fileList: FileList[] } }
  | { type: "fileUploaded"; payload: "saving" | "saved" | "not-saved" | null };

export const storageReducer = (
  state: StorageState,
  action: StorageAction
): StorageState => {
  switch (action.type) {
    case "fileUploaded":
      return {
        ...state,
        uploadStatus: action.payload,
      };
    case "fileDownloaded":
      return {
        ...state,
        errorMessage: "",
        file: action.payload.file,
        downloadFileStatus: "downloaded",
      };
    case "fileListDownloaded":
      return {
        ...state,
        errorMessage: "",
        fileList: action.payload.fileList,
        downloadFilesStatus: "downloaded",
      };
    case "loadingFile":
      return {
        ...state,
        uploadStatus: "saving",
        file: null,
      };
    case "downloadingFile":
      return {
        ...state,
        downloadFileStatus: "downloading",
        file: null,
      };
    case "downloadingFiles":
      return {
        ...state,
        downloadFilesStatus: "downloading",
        fileList: null,
      };
    case "downloadingReset":
      return {
        ...state,
        downloadFileStatus: null,
        file: null,
      };
    case "uploadingError":
      return {
        ...state,
        uploadStatus: "not-saved",
        errorMessage: action.payload,
      };
    case "downloadingFileError":
      return {
        ...state,
        downloadFileStatus: "not-downloaded",
        errorMessage: action.payload,
      };
    case "downloadingFilesError":
      return {
        ...state,
        downloadFilesStatus: "not-downloaded",
        errorMessage: action.payload,
      };
    case "removeError":
      return {
        ...state,
        errorMessage: "",
      };
    case "chatFile":
      return {
        ...state,
        chat: action.payload,
      };
    case "setChatName":
      return {
        ...state,
        chatName: action.payload,
      };
    case "setFullPath":
      return {
        ...state,
        fullPath: action.payload,
      };
    case "setAssetUrl":
      return {
        ...state,
        assetUrl: action.payload,
      };
    case "setRecentFileName":
      return {
        ...state,
        recentFileName: action.payload,
      };
    case "setProgress":
      return {
        ...state,
        progress: action.payload,
      };
    default:
      return state;
  }
};
