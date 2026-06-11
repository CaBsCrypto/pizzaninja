import os
import sys
from PIL import Image

def optimize_image(input_path, output_path):
    print(f"Opening {input_path}...")
    try:
        with Image.open(input_path) as img:
            # Convert to RGB if necessary
            if img.mode != "RGB":
                img = img.convert("RGB")
            
            # Resize if the image is extremely large to save more space,
            # but keep it at least 1920x1080 for high quality
            max_size = (1920, 1080)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # We add a slight dark overlay to the image to ensure text on top remains readable
            # Since PIL doesn't have an easy "darken" filter, we just blend it with a black image
            black = Image.new("RGB", img.size, (5, 8, 12))
            img = Image.blend(img, black, alpha=0.55)
            
            # Save as WebP with 85% quality (excellent balance of size and quality)
            print(f"Saving to {output_path} as WEBP...")
            img.save(output_path, "WEBP", quality=80, method=6)
            
            input_size = os.path.getsize(input_path) / 1024
            output_size = os.path.getsize(output_path) / 1024
            print(f"Success! Original size: {input_size:.2f} KB | Optimized size: {output_size:.2f} KB")
    except Exception as e:
        print(f"Error optimizing image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python compress_bg.py <input_image> <output_image>")
        sys.exit(1)
        
    optimize_image(sys.argv[1], sys.argv[2])
