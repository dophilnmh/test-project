'use client';

import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { useEffect, useRef, useState } from 'react';

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read image'));
    reader.readAsDataURL(file);
  });
}

export function ImageCropUploadField({
  label = 'Upload image',
  helperText = '',
  disabled = false,
  accept = 'image/*',
  buttonText = 'Choose image',
  aspectRatio = 1,
  onCroppedFile,
}) {
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState('image');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const imageRef = useRef(null);
  const cropperRef = useRef(null);

  useEffect(() => {
    if (!source || !imageRef.current) return undefined;

    const image = imageRef.current;
    const initializeCropper = () => {
      cropperRef.current?.destroy();
      cropperRef.current = new Cropper(image, {
        aspectRatio,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        background: false,
        movable: true,
        zoomable: true,
        zoomOnTouch: true,
        zoomOnWheel: true,
        cropBoxMovable: false,
        cropBoxResizable: false,
      });
    };

    if (image.complete) initializeCropper();
    else image.addEventListener('load', initializeCropper, { once: true });

    return () => {
      image.removeEventListener('load', initializeCropper);
      cropperRef.current?.destroy();
      cropperRef.current = null;
    };
  }, [source, aspectRatio]);

  const closeCropper = () => {
    setSource('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFilePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');

    if (!String(file.type || '').startsWith('image/')) {
      setError('Please select a valid image file.');
      event.target.value = '';
      return;
    }

    try {
      setFileName(file.name || 'image');
      setSource(await readImage(file));
    } catch {
      setError('Unable to prepare selected image.');
      event.target.value = '';
    }
  };

  const applyCrop = async () => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    setUploading(true);
    setError('');

    try {
      const canvas = cropper.getCroppedCanvas({
        width: aspectRatio > 1 ? 1280 : 800,
        height: aspectRatio > 1 ? Math.round(1280 / aspectRatio) : 800,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });
      if (!canvas) throw new Error('Unable to crop image');

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error('Unable to crop image')),
          'image/jpeg',
          0.92
        );
      });
      const filename = fileName.replace(/\.[^.]+$/, '') || 'image';
      const uploaded = await onCroppedFile?.(
        new File([blob], `${filename}-cropped.jpg`, { type: 'image/jpeg' })
      );
      if (uploaded !== false) closeCropper();
    } catch {
      setError('Unable to crop and upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <div className="rounded-lg border border-input bg-background px-3 py-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled || uploading}
          onChange={handleFilePick}
          className="w-full text-sm"
          aria-label={buttonText}
        />
      </div>
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {source ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground">
              Position image
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag to position, then use your mouse wheel or pinch to zoom.
            </p>
            <div className="mt-4 h-80 overflow-hidden rounded-lg bg-black">
              <img
                ref={imageRef}
                src={source}
                alt="Image crop preview"
                className="block max-w-full"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCropper}
                disabled={uploading}
                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCrop}
                disabled={uploading}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {uploading ? 'Uploading...' : 'Use image'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
