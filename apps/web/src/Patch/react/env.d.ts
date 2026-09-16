declare module '*.css' {
  const stylesheet: string;
  export default stylesheet;
}

declare module '*.svg?url' {
  const url: string;
  export default url;
}
