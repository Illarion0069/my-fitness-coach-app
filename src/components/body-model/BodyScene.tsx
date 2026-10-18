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
  // Continuous influence fields avoid seams at waist/chest and limb boundaries.
  const smooth = (low: number, high: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  const bell = (center: number, width: number) => Math.exp(-Math.pow((y - center) / width, 2));
  const armWeight = smooth(0.27, 0.40, Math.abs(x)) * smooth(0.98, 1.14, y) * (1 - smooth(1.63, 1.78, y));
  const legWeight = 1 - smooth(0.94, 1.08, y);
  const torsoWeight = (1 - armWeight) * (1 - legWeight);
  const chest = bell(1.55, 0.17), waist = bell(1.30, 0.17), hips = bell(1.09, 0.14);
  const total = Math.max(1, chest + waist + hips);
  const torsoScale = ((bodyRatio(values.chest_cm, baseline.chest_cm) - 1) * chest + (bodyRatio(values.waist_cm, baseline.waist_cm) - 1) * waist + (bodyRatio(values.hips_cm, baseline.hips_cm) - 1) * hips) / total;
  const arm = x > 0 ? 'left_arm_cm' : 'right_arm_cm';
  const leg = x > 0 ? 'left_leg_cm' : 'right_leg_cm';
  const armScale = (bodyRatio(values[arm], baseline[arm]) - 1) * bell(1.42, 0.16) * armWeight;
  const legScale = (bodyRatio(values[leg], baseline[leg]) - 1) * bell(0.81, 0.24) * legWeight;
  const armAxis = Math.sign(x) * (0.37 + (1.55 - y) * 0.46);
  const legAxis = Math.sign(x) * 0.13;
  return [x + x * torsoScale * torsoWeight + (x - armAxis) * armScale + (x - legAxis) * legScale, y, z * (1 + torsoScale * torsoWeight + armScale + legScale)];
}

function Anatomy({ values, baseline, selected, onSelect, compare, palette }: SceneProps & { palette: Palette }) {
  const { scene } = useGLTF(bodyAsset.url);
  const source = useMemo(() => {
    let found: BufferGeometry | undefined;
    scene.traverse(object => { if (!found && object instanceof Mesh) found = object.geometry; });
    if (!found) throw new Error('Body mesh missing');
    const smoothGeometry = found.clone();
    const positions = smoothGeometry.getAttribute('position');
    const indices = smoothGeometry.getIndex();
    if (indices) {
      const neighbors = Array.from({ length: positions.count }, () => new Set<number>());
      for (let i = 0; i < indices.count; i += 3) {
        const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
        for (const vertex of triangle) for (const other of triangle) if (other !== vertex) neighbors[vertex].add(other);
      }
      // Gentle topology-aware smoothing, without adding triangles on phones.
      for (let pass = 0; pass < 4; pass++) {
        const next = new Float32Array(positions.array);
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const adjacent = neighbors[vertex];
          if (!adjacent.size) continue;
          for (let axis = 0; axis < 3; axis++) {
            let sum = 0;
            adjacent.forEach(other => { sum += positions.array[other * 3 + axis]; });
            next[vertex * 3 + axis] += (sum / adjacent.size - positions.array[vertex * 3 + axis]) * 0.28;
          }
        }
        positions.array.set(next);
      }
      positions.needsUpdate = true;
      smoothGeometry.computeVertexNormals();
    }
    return smoothGeometry;
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

  useEffect(() => () => { geometry.dispose(); baselineGeometry.dispose(); source.dispose(); }, [geometry, baselineGeometry, source]);
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
      <meshStandardMaterial vertexColors roughness={0.62} metalness={0.03} />
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
  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.12} rotateSpeed={0.7} minDistance={2.6} maxDistance={5.5} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI * 2 / 3} />;
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