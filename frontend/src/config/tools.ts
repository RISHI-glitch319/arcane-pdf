import {
  Minimize2,
  Maximize2,
  RotateCcw,
  FileImage,
  Zap,
  Image as ImageIcon,
  Droplets,
  ScanText
} from "lucide-react";

export const IMAGE_TOOLS = [
  { 
    name: "Compress Image", 
    desc: "Reduce image size while maintaining quality", 
    icon: Minimize2, 
    href: "/compress-image", 
    category: "Optimize Image",
    slug: "compress-image" 
  },
  { 
    name: "Resize Image", 
    desc: "Adjust image dimensions precisely", 
    icon: Maximize2, 
    href: "/resize", 
    category: "Edit Image",
    slug: "resize"
  },
  { 
    name: "Rotate Image", 
    desc: "Rotate image to desired angle", 
    icon: RotateCcw, 
    href: "/rotate", 
    category: "Edit Image",
    slug: "rotate"
  },
  { 
    name: "Convert Image", 
    desc: "Convert PNG, WEBP, SVG, etc. to JPG", 
    icon: FileImage, 
    href: "/convert", 
    category: "Convert Image",
    slug: "convert"
  },
  { 
    name: "Enhance Image", 
    desc: "Enhance resolution using AI manipulation", 
    icon: Zap, 
    href: "/enhance", 
    category: "Edit Image",
    slug: "enhance"
  },
  { 
    name: "Remove Background", 
    desc: "Automatically remove image background", 
    icon: ImageIcon, 
    href: "/remove-bg", 
    category: "Edit Image",
    slug: "remove-bg"
  },
  { 
    name: "Watermark Image", 
    desc: "Add watermark for branding/security", 
    icon: Droplets, 
    href: "/watermark", 
    category: "Edit Image",
    slug: "watermark"
  },
  { 
    name: "OCR Image", 
    desc: "Scan characters directly overlaid onto the image payload layer", 
    icon: ScanText, 
    href: "/ocr-image", 
    category: "PDF Intelligence",
    slug: "ocr-image"
  },
];
