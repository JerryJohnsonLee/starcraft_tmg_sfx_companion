import os
import subprocess

ffmpeg_path = r"C:\Users\jerry\AppData\Roaming\bilibili\ffmpeg\ffmpeg.exe"

def convert_to_ogg(root_dir):
    if not os.path.exists(ffmpeg_path):
        print(f"Error: ffmpeg.exe not found at {ffmpeg_path}")
        return
        
    print(f"Starting OGG conversion in '{root_dir}' using ffmpeg...")
    converted_count = 0
    scanned_count = 0
    
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.lower().endswith('.wav'):
                scanned_count += 1
                wav_path = os.path.join(root, file)
                ogg_path = os.path.splitext(wav_path)[0] + '.ogg'
                
                # ffmpeg command: transcode to OGG Vorbis with Quality level 4
                cmd = [
                    ffmpeg_path,
                    '-y',
                    '-i', wav_path,
                    '-c:a', 'libvorbis',
                    '-q:a', '4',
                    ogg_path
                ]
                
                try:
                    # Run ffmpeg quietly
                    result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                    if os.path.exists(ogg_path) and os.path.getsize(ogg_path) > 0:
                        # Successfully converted, delete original WAV file!
                        os.remove(wav_path)
                        print(f"CONVERTED: {wav_path} -> {ogg_path}")
                        converted_count += 1
                    else:
                        print(f"FAILED: {wav_path} (OGG empty or not created)")
                except Exception as e:
                    print(f"ERROR converting {wav_path}: {e}")
                    
    print(f"\nOGG Conversion complete!")
    print(f"Scanned: {scanned_count} WAV files.")
    print(f"Successfully converted: {converted_count} files to OGG (and removed old WAVs).")

if __name__ == '__main__':
    convert_to_ogg('units')
