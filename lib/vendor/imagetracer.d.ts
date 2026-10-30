// Types for imagetracer.js (public domain, https://github.com/jankovicsandras/imagetracerjs)
export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface TracerOptions {
  ltres?: number;
  qtres?: number;
  pathomit?: number;
  rightangleenhance?: boolean;
  colorsampling?: number;
  numberofcolors?: number;
  mincolorratio?: number;
  colorquantcycles?: number;
  layering?: number;
  strokewidth?: number;
  linefilter?: boolean;
  scale?: number;
  roundcoords?: number;
  viewbox?: boolean;
  desc?: boolean;
  blurradius?: number;
  blurdelta?: number;
}

declare const ImageTracer: {
  imagedataToSVG(imgd: ImageDataLike, options?: TracerOptions | string): string;
};

export default ImageTracer;