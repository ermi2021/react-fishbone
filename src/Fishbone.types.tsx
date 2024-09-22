import React from "react";

type NotEmptyReadonlyArray<T> = Readonly<[T, ...T[]]>;

export type FishboneNode = {
  name: string;
  children?: FishboneNode[];
};

export type LineConfig = {
  color: string;
  strokeWidthPx: number;
};

export type NodeConfig = {
  color: string;
  fontSizeEm: number;
  backgroundColor?: string; // Change this to your desired background color
  borderRadius?: string; // Makes the background circular
  padding?: number;
};

export type FishboneProps = {
  width?: string | number;
  height?: string | number;
  items?: FishboneNode;
  linesConfig?: NotEmptyReadonlyArray<LineConfig>;
  nodesConfig?: NotEmptyReadonlyArray<NodeConfig>;
  wrapperStyle?: React.CSSProperties;
};
