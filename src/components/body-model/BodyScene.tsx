import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, Html, useGLTF } from '@react-three/drei';
import { BufferAttribute, Color, Mesh, Vector3, type BufferGeometry } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
import bodyAsset from '@/assets/anatomical-body.glb.asset.json';
import { bodyRatio, bodyRegion, type BodyMetric, type BodyValues } from '@/lib/bodyModel';

type Palette = { surface: string; accent: string; ghost: string; light: string };
interface SceneProps { values: BodyValues; baseline: BodyValues; selected: BodyMetric; onSelect: (key: BodyMetric) => void; compare: boolean; view: number; lang: string }

function tokenColor(name: string) {
  return new Color(`hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).join(', ')})`).getStyle();
}

function deformation(x: number, y: number, z: number, values: BodyValues, baseline: BodyValues): [number, number, number] {
  const region = bodyRegion(x, y);
  if (!region) return [x, y, z];
  const ratio = bodyRatio(values[region], baseline[region]);
  // Local radial changes preserve height and leave joints, hands and head stable.
  const centers: Partial<Record<BodyMetric, number>> = { chest_cm: 1.55, waist_cm: 1.30, hips_cm: 1.09, left_arm_cm: 1.42, right_arm_cm: 1.42, left_leg_cm: 0.81, right_leg_cm: 0.81 };
  const center = centers[region] ?? y;
  const falloff = Math.exp(-Math.pow((y - center) / (region.includes('leg') ? 0.24 : 0.16), 2));
  const scale = 1 + (ratio - 1) * falloff;
  const axis = region.includes('arm') ? Math.sign(x) * (0.37 + (1.55 - y) * 0.46) : region.includes('leg') ? Math.sign(x) * 0.13 : 0;
  return [axis + (x - axis) * scale, y, z * scale];
}

function Anatomy({ values, baseline, selected, onSelect, compare, palette }: SceneProps & { palette: Palette }) {
  const { scene } = useGLTF(bodyAsset.url);
  const source = useMemo(() => {
    let found: BufferGeometry | undefined;
    scene.traverse(object => { if (!found && object instanceof Mesh) found = object.geometry; });
    if (!found) throw new Error('Body mesh missing');
    return found;
  }, [scene]);
  const geometry = useMemo(() => source.clone(), [source]);
  const baselineGeometry = useMemo(() => source.clone(), [source]);
  const original = useMemo(() => new Float32Array(source.getAttribute('position').array), [source]);
  const target = useRef(new Float32Array(original));
  const changed = useRef(true);
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => {
    const colors = new Float32Array(original.length);
    const muted = new Color(palette.surface), active = new Color(palette.accent);
    for (let i = 0; i < original.length; i += 3) {
      const [x, y, z] = deformation(original[i], original[i + 1], original[i + 2], values, baseline);
      target.current[i] = x; target.current[i + 1] = y; target.current[i + 2] = z;
      const color = bodyRegion(original[i], original[i + 1]) === selected ? active : muted;
      color.toArray(colors, i);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    changed.current = true;
  }, [values, baseline, selected, palette, geometry, original]);

  useEffect(() => () => { geometry.dispose(); baselineGeometry.dispose(); }, [geometry, baselineGeometry]);
  useFrame((_, rawDelta) => {
    if (!changed.current) return;
    const position = geometry.getAttribute('position');
    const amount = reduced ? 1 : 1 - Math.exp(-10 * Math.min(rawDelta, 0.05));
    let distance = 0;
    for (let i = 0; i < position.array.length; i++) {
      const diff = target.current[i] - position.array[i];
      position.array[i] += diff * amount;
      distance = Math.max(distance, Math.abs(diff));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    changed.current = distance > 0.0001;
  });

  return <group position={[0, -1, 0]}>
    {compare && <mesh geometry={baselineGeometry}>
      <meshBasicMaterial color={palette.ghost} wireframe transparent opacity={0.14} depthWrite={false} />
    </mesh>}
    <mesh geometry={geometry} onClick={event => {
      event.stopPropagation();
      const local = event.object.worldToLocal(event.point.clone());
      const region = bodyRegion(local.x, local.y);
      if (region) onSelect(region);
    }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.12} />
    </mesh>
  </group>;
}

function CameraControl({ view }: { view: number }) {
  const controls = useRef<Controls>(null);
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    control.object.position.set(Math.sin(view) * 3.8, 0.15, Math.cos(view) * 3.8);
    control.target.copy(new Vector3(0, 0, 0));
    control.update();
  }, [view]);
  return <OrbitControls ref={controls} enablePan={false} minDistance={2.6} maxDistance={5.5} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI * 2 / 3} />;
}

class SceneBoundary extends Component<{ children: ReactNode; lang: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center">{this.props.lang === 'en' ? '3D view is unavailable on this device. Measurements remain available.' : '3D недоступно на этом устройстве. Замеры остаются доступны.'}</div> : this.props.children;
  }
}

export default function BodyScene(props: SceneProps) {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const update = () => setPalette({ surface: tokenColor('--body-surface'), accent: tokenColor('--primary'), ghost: tokenColor('--body-ghost'), light: tokenColor('--body-light') });
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { observer.disconnect(); document.body.style.cursor = ''; };
  }, []);
  if (!palette) return null;
  return <SceneBoundary lang={props.lang}>
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.15, 3.8], fov: 36 }} gl={{ antialias: true }} fallback={<div className="p-8 text-muted-foreground">{props.lang === 'en' ? '3D unavailable' : '3D недоступно'}</div>}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={2.3} color={palette.light} />
      <directionalLight position={[-3, 1, -2]} intensity={1.5} color={palette.ghost} />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 3, 4]} scale={[5, 5, 1]} color={palette.light} />
        <Lightformer intensity={1} position={[-3, 0, 0]} rotation-y={Math.PI / 2} scale={[3, 6, 1]} color={palette.light} />
      </Environment>
      <Suspense fallback={<Html center><span className="text-sm text-muted-foreground whitespace-nowrap">{props.lang === 'en' ? 'Loading body…' : 'Загрузка модели…'}</span></Html>}>
        <Anatomy {...props} palette={palette} />
      </Suspense>
      <CameraControl view={props.view} />
    </Canvas>
  </SceneBoundary>;
}