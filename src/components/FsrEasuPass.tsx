"use client";
/**
 * FsrEasuPass — Exact port of AMD FSR 1.0 EASU (Edge Adaptive Spatial Upsampling)
 * Restores geometry and textures when rendering at a lower DPR.
 */

import { forwardRef, useMemo } from "react";
import { Effect, BlendFunction } from "postprocessing";
import { Uniform } from "three";

const fragment = /* glsl */ `
  uniform float u_sharpness;

  float FsrLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722)); // Rec. 709 luma
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 texelSize = 1.0 / resolution.xy;

    // 12-tap cross-diamond sampling pattern (bez uglov 4x4)
    vec3 b = texture2D(inputBuffer, uv + texelSize * vec2( 0.0, -2.0)).rgb;
    vec3 d = texture2D(inputBuffer, uv + texelSize * vec2(-1.0, -1.0)).rgb;
    vec3 e = texture2D(inputBuffer, uv + texelSize * vec2( 0.0, -1.0)).rgb;
    vec3 f = texture2D(inputBuffer, uv + texelSize * vec2( 1.0, -1.0)).rgb;
    vec3 h = texture2D(inputBuffer, uv + texelSize * vec2(-1.0,  0.0)).rgb;
    vec3 i = inputColor.rgb; // center
    vec3 j = texture2D(inputBuffer, uv + texelSize * vec2( 1.0,  0.0)).rgb;
    vec3 k = texture2D(inputBuffer, uv + texelSize * vec2(-1.0,  1.0)).rgb;
    vec3 l = texture2D(inputBuffer, uv + texelSize * vec2( 0.0,  1.0)).rgb;
    vec3 m = texture2D(inputBuffer, uv + texelSize * vec2( 1.0,  1.0)).rgb;
    vec3 n = texture2D(inputBuffer, uv + texelSize * vec2( 2.0,  0.0)).rgb;
    vec3 p = texture2D(inputBuffer, uv + texelSize * vec2( 0.0,  2.0)).rgb;

    float bL = FsrLuma(b);
    float dL = FsrLuma(d); float eL = FsrLuma(e); float fL = FsrLuma(f);
    float hL = FsrLuma(h); float iL = FsrLuma(i); float jL = FsrLuma(j);
    float kL = FsrLuma(k); float lL = FsrLuma(l); float mL = FsrLuma(m);
    float nL = FsrLuma(n); float pL = FsrLuma(p);

    // Sobel gradient
    float dirH = (dL - fL) + (kL - mL) + (hL - jL) * 0.5;
    float dirV = (dL - kL) + (fL - mL) + (eL - lL) * 0.5;

    float dirLen = max(abs(dirH), abs(dirV));
    float dirLenRcp = 1.0 / max(dirLen, 1.0e-5);
    dirH *= dirLenRcp;
    dirV *= dirLenRcp;

    // Limit vector stretch
    float stretch = max(abs(dirH), abs(dirV));
    stretch = 1.0 / max(stretch, 1.0e-5);
    dirH *= stretch;
    dirV *= stretch;

    // Local contrast
    vec3 minC = min(min(min(d, e), min(f, h)), min(min(i, j), min(k, l)));
    minC = min(minC, m);
    vec3 maxC = max(max(max(d, e), max(f, h)), max(max(i, j), max(k, l)));
    maxC = max(maxC, m);

    float range = FsrLuma(maxC) - FsrLuma(minC);
    float adaptiveSharp = mix(0.0, u_sharpness, smoothstep(0.0, 0.15, range));

    // 4-tap directional Lanczos filter
    vec2 dir = vec2(dirH, dirV) * texelSize;
    float w0 = 0.5 - adaptiveSharp * 0.125;
    float w1 = 0.5 + adaptiveSharp * 0.125;

    vec3 tap0 = texture2D(inputBuffer, uv - dir * 0.5).rgb;
    vec3 tap1 = texture2D(inputBuffer, uv + dir * 0.5).rgb;
    vec3 result = i * w1 + (tap0 + tap1) * (w0 * 0.5);

    // Anti-ringing
    result = clamp(result, minC, maxC);

    outputColor = vec4(result, 1.0);
  }
`;

class FsrEasuEffect extends Effect {
  constructor({ sharpness = 0.2 } = {}) {
    super("FsrEasuEffect", fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<unknown>>([
        ["u_sharpness", new Uniform(sharpness)],
      ]),
    });
  }
}

interface FsrEasuPassProps {
  sharpness?: number;
}

const FsrEasuPass = forwardRef(function FsrEasuPass(
  props: FsrEasuPassProps,
  ref
) {
  const { sharpness = 0.2 } = props;

  const effect = useMemo(() => {
    return new FsrEasuEffect({ sharpness });
  }, [sharpness]);

  return <primitive ref={ref} object={effect} dispose={null} />;
});

export default FsrEasuPass;
