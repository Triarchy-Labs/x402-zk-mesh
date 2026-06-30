"use client";

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useLoader, useThree, useFrame } from '@react-three/fiber';
import { useGLTF, Center, Resize, useAnimations } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GLTFLoader, KTX2Loader, DRACOLoader } from 'three-stdlib';
import FsrEasuPass from './FsrEasuPass';
import FsrRcasPass from './FsrRcasPass';

useGLTF.preload('/models/tech-rings-v2-optimize.glb');

// ========================================================
// МАТЕРИАЛЫ И МОДЕЛИ
// ========================================================

interface GLTFResult {
	scene: THREE.Group;
	animations: THREE.AnimationClip[];
}

function useRingEnvMap() {
	return useMemo(() => {
		const loader = new THREE.TextureLoader();
		const tex = loader.load('/textures/environment-prism.png');
		tex.mapping = THREE.EquirectangularReflectionMapping;
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}, []);
}

function useSceneEnvMap() {
	return useMemo(() => {
		const loader = new THREE.TextureLoader();
		const tex = loader.load('/textures/background-environment.png');
		tex.mapping = THREE.EquirectangularReflectionMapping;
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}, []);
}

function createGlassRingMaterial(envMap: THREE.Texture): THREE.MeshPhysicalMaterial {
	return new THREE.MeshPhysicalMaterial({
		side: THREE.DoubleSide,
		color: new THREE.Color("#f4f4f4"),
		roughness: 0,
		metalness: 0,
		ior: 1.5,
		transmission: 1,
		thickness: 0.5,
		sheen: 1.0,
		sheenRoughness: 0.1156,
		sheenColor: new THREE.Color("#ffe199"),
		clearcoat: 0,
		clearcoatRoughness: 0,
		specularIntensity: 1,
		specularColor: new THREE.Color("#ffffff"),
		reflectivity: 1,
		envMap: envMap,
		envMapIntensity: 13.4,
		transparent: false,
		opacity: 1,
	});
}

function AnimatedRing({
	gltf,
	scale,
	position,
	speed = 1.0,
	hideInnerRings = 0,
}: {
	gltf: GLTFResult;
	scale: number;
	position: [number, number, number];
	speed?: number;
	hideInnerRings?: number;
}) {
	const groupRef = useRef<THREE.Group>(null);
	const { actions } = useAnimations(gltf.animations, groupRef);
	const ringEnvMap = useRingEnvMap();

	const clonedScene = useMemo(() => {
		const clone = gltf.scene.clone();
		const mat = createGlassRingMaterial(ringEnvMap);

		// Фильтрация внутренних колец (для v2 модели с 4 нодами)
		if (hideInnerRings > 0) {
			const children = [...clone.children];
			for (let i = 0; i < Math.min(hideInnerRings, children.length); i++) {
				clone.remove(children[i]);
			}
		}

		clone.traverse((child: THREE.Object3D) => {
			const mesh = child as THREE.Mesh;
			if (mesh.isMesh) {
				mesh.castShadow = true;
				mesh.receiveShadow = true;
				mesh.material = mat;
			}
		});
		return clone;
	}, [gltf, ringEnvMap, hideInnerRings]);

	useEffect(() => {
		if (actions) {
			Object.values(actions).forEach(action => {
				if (action) {
					action.timeScale = speed;
					action.play();
				}
			});
		}
	}, [actions, speed]);

	useFrame((_, delta) => {
		if (groupRef.current && (!actions || Object.keys(actions).length === 0)) {
			groupRef.current.rotation.y += speed * delta * 0.8;
		}
	});

	return (
		<group ref={groupRef} position={position} scale={scale}>
			<primitive object={clonedScene} />
		</group>
	);
}

function MirrorRings() {
	const gltfV2 = useGLTF('/models/tech-rings-v2-optimize.glb') as unknown as GLTFResult;

	// ТОЛЬКО v2 (4 ноды, 1 GLTF-анимация)
	// Ring-a УДАЛЁН: scale 0.23, 0 анимаций, обхватывал камень
	// Ring-b УДАЛЁН: scale 0.26 * parent 2.8 = 0.73, пересекал рок Resize=2.6
	return (
		<group
			position={[0, 0.05, 0]}
			scale={[2.4, 2.8, 2.8]}
			rotation={[0, Math.PI / 2, 0]}
		>
			<AnimatedRing
				gltf={gltfV2}
				scale={0.35}
				position={[0, 0, 0]}
				speed={0.05}
			/>
		</group>
	);
}

function WasiRock() {
	const gl = useThree((state) => state.gl);

	const gltf = useLoader(GLTFLoader, '/models/rock-clean.glb', (loader) => {
		const dracoLoader = new DRACOLoader();
		dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
		const gltfLoader = loader as GLTFLoader;
		gltfLoader.setDRACOLoader(dracoLoader);

		const ktx2Loader = new KTX2Loader();
		ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
		if (gl) {
			try { ktx2Loader.detectSupport(gl); } catch { /* noop */ }
		}
		gltfLoader.setKTX2Loader(ktx2Loader);
	});

	const rockRef = useRef<THREE.Group>(null);

	const rockScene = useMemo(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const clone = (gltf as any).scene.clone();
		let hasMeshes = false;
		clone.traverse((c: THREE.Object3D) => {
			const mesh = c as THREE.Mesh;
			if (mesh.isMesh && mesh.geometry?.attributes?.position?.count > 0) {
				hasMeshes = true;
				mesh.castShadow = true;
				mesh.receiveShadow = true;
				if (mesh.material) {
					const mat = mesh.material as THREE.MeshStandardMaterial;
					mat.envMapIntensity = 0.5;
					mat.needsUpdate = true;
					if (mesh.visible === false || mat.opacity === 0) {
						mesh.visible = true;
						mat.transparent = false;
						mat.opacity = 1.0;
					}
				}
			}
		});
		return { scene: clone, hasMeshes };
	}, [gltf]);

	return (
		<Center>
			<group ref={rockRef} rotation={[0, 0, -0.1206]}>
				{rockScene.hasMeshes ? (
					<Resize scale={2.6}>
						<primitive object={rockScene.scene} />
					</Resize>
				) : (
					<mesh scale={1.5}>
						<icosahedronGeometry args={[1.5, 2]} />
						<meshStandardMaterial envMapIntensity={2.0} roughness={1.0} color="#555555" />
					</mesh>
				)}
			</group>
		</Center>
	);
}

function SceneEnvironment() {
	const envMap = useSceneEnvMap();
	const applied = useRef(false);

	useFrame(({ scene }) => {
		if (!applied.current && envMap.image) {
			scene.environment = envMap;
			scene.environmentIntensity = 0.8;
			scene.environmentRotation = new THREE.Euler(0, 1.6268, 0);
			applied.current = true;
		}
	});

	return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AnimatedArchitecture({ theme: _theme }: { theme: "light" | "dark" }) {
	const containerRef = useRef<HTMLDivElement>(null);

	return (
		<div
			ref={containerRef}
			style={{
				width: "100%",
				height: "100vh",
				minHeight: "700px",
				margin: "0",
				position: "relative",
				zIndex: 10,
				cursor: "crosshair",
			}}
		>
			<Canvas
				shadows
				camera={{ position: [0, -0.021, 12], fov: 35, near: 0.1, far: 1000 }}
				gl={{ antialias: true, alpha: true }}
				dpr={[0.5, 0.75]}
			>
				<SceneEnvironment />

				{/* Дамп: AmbientLight intensity=0 */}
				<ambientLight intensity={0} />

				{/* ====== 100% SpotLights ИЗ ДАМПА ====== */}
				<spotLight
					position={[0.074, 1.601, 0]}
					intensity={25}
					angle={0.524}
					penumbra={0.524}
					color="#fbfbfb"
					distance={20}
					decay={2}
					castShadow={false}
				/>
				<spotLight
					position={[-0.993, 5.038, 1.364]}
					intensity={25}
					angle={0.730}
					penumbra={0.524}
					color="#fbfbfb"
					distance={20}
					decay={0}
					castShadow={true}
					shadow-mapSize={[2048, 2048]}
					shadow-camera-far={20}
					shadow-bias={-0.0001}
				/>
				<spotLight
					position={[2.257, -0.430, 0.679]}
					intensity={20.23}
					angle={0.524}
					penumbra={0.524}
					color="#fbfbfb"
					distance={20}
					decay={2}
					castShadow={true}
					shadow-mapSize={[1024, 1024]}
				/>

				<group>
					<WasiRock />
				</group>

				<MirrorRings />

				<EffectComposer>
					<FsrEasuPass sharpness={0.2} />
					<FsrRcasPass sharpness={1.0} />
				</EffectComposer>
			</Canvas>
		</div>
	);
}
