import React, { useEffect, useState } from "react";

export default function SafeAvatarImage({ src, fallbackSrc, alt, ...props }) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  return (
    <img
      {...props}
      src={!errored && src ? src : fallbackSrc}
      alt={alt}
      onError={() => setErrored(true)}
    />
  );
}
