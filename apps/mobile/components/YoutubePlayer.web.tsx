import React from 'react';

interface Props {
  height?: number;
  videoId: string;
  play?: boolean;
}

export default function YoutubePlayer({ height = 220, videoId, play = false }: Props) {
  const src = `https://www.youtube.com/embed/${videoId}${play ? '?autoplay=1' : ''}`;
  
  return (
    <iframe
      width="100%"
      height={height}
      src={src}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      style={{ borderRadius: 8 }}
    />
  );
}
