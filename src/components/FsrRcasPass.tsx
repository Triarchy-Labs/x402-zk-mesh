"use client";
/**
 * FsrRcasPass — Exact 1:1 port of Lusion Labs FSR RCAS (Robust Contrast-Adaptive Sharpening)
 * Source: lusion_formatted.js lines 42242-42291
 * Extracted: lusion_dump_chunks/24_fsr_smaa.md (lines 71-101)
 *
 * FSR RCAS is the second pass of AMD FidelityFX Super Resolution.
 * It applies adaptive sharpening that detects edges and only sharpens
 * where it won't create artifacts.
 *
 * For R3F, we use this WITHOUT EASU (the upscaler) since R3F Canvas dpr
 * already handles resolution scaling. RCAS alone gives the "crisp" look
 * that Lusion achieves — sharpening the slightly soft result of SMAA+Bloom.
 *
 * Lusion default: upscalerSharpness = 1
 */

import { forwardRef, useMemo } from "react";
import { Effect, BlendFunction } from "postprocessing";
import { Uniform } from "three";

// Exact GLSL from Lusion lines 42243-42249
const fragment = /* glsl */ `
  uniform float u_sharpness;

  // Lusion exact: FsrRcasCon (строка 42243)
  float FsrRcasCon(float sharpness) {
    return exp2(-sharpness);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 texelSize = 1.0 / resolution.xy;

    // 5-tap cross pattern: center + up/down/left/right (Lusion exact)
    vec3 e = inputColor.rgb;  // center
    vec3 b = texture2D(inputBuffer, uv + vec2(0.0, -texelSize.y)).rgb;  // up
    vec3 d = texture2D(inputBuffer, uv + vec2(-texelSize.x, 0.0)).rgb;  // left
    vec3 f = texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb;   // right
    vec3 h = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb;   // down

    // Luma for each sample (Rec. 709)
    float bL = dot(b, vec3(0.2126, 0.7152, 0.0722));
    float dL = dot(d, vec3(0.2126, 0.7152, 0.0722));
    float eL = dot(e, vec3(0.2126, 0.7152, 0.0722));
    float fL = dot(f, vec3(0.2126, 0.7152, 0.0722));
    float hL = dot(h, vec3(0.2126, 0.7152, 0.0722));

    // Min/max of cross neighborhood per channel (Lusion exact)
    vec3 mn4 = min(min(b, d), min(f, h));
    vec3 mx4 = max(max(b, d), max(f, h));

    // Avoid division by zero and preserve sign
    vec3 hitMin = mn4 / (4.0 * mx4 + 1e-5);
    vec3 hitMax = (1.0 - mx4) / (4.0 * mn4 - 4.0 - 1e-5);
    vec3 lobeRGB = max(-hitMin, hitMax);
    
    float FSR_RCAS_LIMIT = 0.1875;
    float con = FsrRcasCon(u_sharpness);
    float lobe = max(-FSR_RCAS_LIMIT, min(max(lobeRGB.r, max(lobeRGB.g, lobeRGB.b)), 0.0)) * con;

    // Weighted average (Lusion exact)
    vec3 col = (lobe * (b + d + h + f) + e) / (4.0 * lobe + 1.0);
    outputColor = vec4(col, 1.0);
  }
`;

class FsrRcasEffect extends Effect {
  constructor({ sharpness = 1.0 } = {}) {
    super("FsrRcasEffect", fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<unknown>>([
        ["u_sharpness", new Uniform(sharpness)],
      ]),
    });
  }
}

interface FsrRcasPassProps {
  sharpness?: number; // Lusion default: 1.0
}

/**
 * R3F wrapper for FSR RCAS sharpening.
 * Place in <EffectComposer> AFTER SMAA (matching Lusion pipeline order).
 */
const FsrRcasPass = forwardRef(function FsrRcasPass(
  props: FsrRcasPassProps,
  ref
) {
  const { sharpness = 1.0 } = props;

  const effect = useMemo(() => {
    return new FsrRcasEffect({ sharpness });
  }, [sharpness]);

  return <primitive ref={ref} object={effect} dispose={null} />;
});

export default FsrRcasPass;
