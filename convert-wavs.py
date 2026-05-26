import os
import wave
import struct
import audioop

def convert_adpcm_to_pcm(filepath):
    try:
        # Open WAV file
        with open(filepath, 'rb') as f:
            riff_header = f.read(12)
            if riff_header[0:4] != b'RIFF' or riff_header[8:12] != b'WAVE':
                return False
            
            fmt_chunk = None
            data_chunk_offset = None
            data_chunk_size = None
            
            while True:
                chunk_header = f.read(8)
                if len(chunk_header) < 8:
                    break
                chunk_id, chunk_size = struct.unpack('<4sI', chunk_header)
                
                if chunk_id == b'fmt ':
                    fmt_chunk = f.read(chunk_size)
                    if chunk_size % 2 != 0:
                        f.read(1)
                elif chunk_id == b'data':
                    data_chunk_offset = f.tell()
                    data_chunk_size = chunk_size
                    f.seek(chunk_size, 1)
                    if chunk_size % 2 != 0:
                        f.seek(1, 1)
                else:
                    f.seek(chunk_size, 1)
                    if chunk_size % 2 != 0:
                        f.seek(1, 1)
                        
            if not fmt_chunk or data_chunk_offset is None:
                return False
                
            # Unpack first 16 bytes of format chunk
            fmt_code, channels, sample_rate, byte_rate, block_align, bits_per_sample = struct.unpack('<HHIIHH', fmt_chunk[0:16])
            
            if fmt_code != 17:
                return False # Already standard PCM or another format
                
            # Read raw ADPCM data
            f.seek(data_chunk_offset)
            adpcm_data = f.read(data_chunk_size)
            
        # Decode using high-fidelity C-implemented standard library
        pcm_bytes = bytearray()
        offset = 0
        while offset < len(adpcm_data):
            block = adpcm_data[offset:offset+block_align]
            if len(block) < 4:
                break
            offset += block_align
            
            # 4-byte block header: predictor (16-bit signed), index (8-bit unsigned)
            valpred, index = struct.unpack('<hB', block[0:3])
            
            # High-fidelity decode
            pcm_block, _ = audioop.adpcm2lin(block[4:], 2, (valpred, index))
            
            # Prepend block header predictor sample
            pcm_bytes.extend(struct.pack('<h', valpred))
            pcm_bytes.extend(pcm_block)
            
        # Write standard PCM WAV
        with wave.open(filepath, 'wb') as out:
            out.setnchannels(channels)
            out.setsampwidth(2) # 16-bit
            out.setframerate(sample_rate)
            out.writeframes(bytes(pcm_bytes))
            
        print(f"HI-FI CONVERTED: {filepath}")
        return True
    except Exception as e:
        print(f"FAILED TO CONVERT: {filepath} - {e}")
        return False

def scan_and_convert(directory):
    print(f"\nStarting high-fidelity conversion scan in: {directory}")
    converted_count = 0
    scanned_count = 0
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.wav'):
                scanned_count += 1
                filepath = os.path.join(root, file)
                if convert_adpcm_to_pcm(filepath):
                    converted_count += 1
                    
    print(f"Conversion complete! Transcoded {converted_count} files to flawless PCM WAV.")

if __name__ == '__main__':
    scan_and_convert('units')
