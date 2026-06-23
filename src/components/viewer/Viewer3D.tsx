import { useRef, useMemo, useEffect, Component, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { useViewerStore } from '../../store/viewerStore';
import { useSeismicStore } from '../../store/seismicStore';
import { useInterpretationStore } from '../../store/interpretationStore';
import { createColormapTexture } from '../../utils/colormap';
import { MOCK_DATASET } from '../../data/mockSeismic';
import { ColormapType } from '../../../shared/types';

function createSliceTexture(
  sliceData: Float32Array,
  width: number,
  height: number,
  colormap: ColormapType,
  minVal: number,
  maxVal: number
): THREE.DataTexture {
  const colormapData = createColormapTexture(colormap, 256);
  const imageData = new Uint8Array(width * height * 4);
  
  for (let i = 0; i < sliceData.length; i++) {
    const val = sliceData[i];
    const normalized = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    const colorIdx = Math.floor(normalized * 255) * 4;
    
    imageData[i * 4] = colormapData[colorIdx];
    imageData[i * 4 + 1] = colormapData[colorIdx + 1];
    imageData[i * 4 + 2] = colormapData[colorIdx + 2];
    imageData[i * 4 + 3] = 255;
  }
  
  const texture = new THREE.DataTexture(
    imageData,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  
  return texture;
}

function InlineSlice() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { inlineIndex, colormap, opacity } = useViewerStore();
  const { getSlice } = useSeismicStore();
  const { inlineCount, crosslineCount, timeSamples, inlineStep, crosslineStep, sampleInterval } = MOCK_DATASET;
  
  const sliceData = useMemo(() => getSlice('inline', inlineIndex), [inlineIndex, getSlice]);
  
  const texture = useMemo(() => {
    return createSliceTexture(
      sliceData.data,
      sliceData.width,
      sliceData.height,
      colormap,
      sliceData.minValue,
      sliceData.maxValue
    );
  }, [sliceData, colormap]);
  
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    }
  }, [texture, opacity]);
  
  const x = inlineIndex * inlineStep;
  const width = crosslineCount * crosslineStep;
  const height = timeSamples * sampleInterval;
  
  return (
    <mesh ref={meshRef} position={[x, width / 2, height / 2]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={opacity} map={texture} />
    </mesh>
  );
}

function CrosslineSlice() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { crosslineIndex, colormap, opacity } = useViewerStore();
  const { getSlice } = useSeismicStore();
  const { inlineCount, crosslineCount, timeSamples, inlineStep, crosslineStep, sampleInterval } = MOCK_DATASET;
  
  const sliceData = useMemo(() => getSlice('crossline', crosslineIndex), [crosslineIndex, getSlice]);
  
  const texture = useMemo(() => {
    return createSliceTexture(
      sliceData.data,
      sliceData.width,
      sliceData.height,
      colormap,
      sliceData.minValue,
      sliceData.maxValue
    );
  }, [sliceData, colormap]);
  
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    }
  }, [texture, opacity]);
  
  const y = crosslineIndex * crosslineStep;
  const width = inlineCount * inlineStep;
  const height = timeSamples * sampleInterval;
  
  return (
    <mesh ref={meshRef} position={[width / 2, y, height / 2]} rotation={[0, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={opacity} map={texture} />
    </mesh>
  );
}

function TimeSlice() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { timeIndex, colormap, opacity } = useViewerStore();
  const { getSlice } = useSeismicStore();
  const { inlineCount, crosslineCount, timeSamples, inlineStep, crosslineStep, sampleInterval } = MOCK_DATASET;
  
  const sliceData = useMemo(() => getSlice('timeslice', timeIndex), [timeIndex, getSlice]);
  
  const texture = useMemo(() => {
    return createSliceTexture(
      sliceData.data,
      sliceData.width,
      sliceData.height,
      colormap,
      sliceData.minValue,
      sliceData.maxValue
    );
  }, [sliceData, colormap]);
  
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    }
  }, [texture, opacity]);
  
  const z = timeIndex * sampleInterval;
  const width = inlineCount * inlineStep;
  const depth = crosslineCount * crosslineStep;
  
  return (
    <mesh ref={meshRef} position={[width / 2, depth / 2, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={opacity} map={texture} />
    </mesh>
  );
}

function VolumeBox() {
  const { inlineCount, crosslineCount, timeSamples, inlineStep, crosslineStep, sampleInterval } = MOCK_DATASET;
  
  const width = inlineCount * inlineStep;
  const height = crosslineCount * crosslineStep;
  const depth = timeSamples * sampleInterval;
  
  return (
    <mesh position={[width / 2, height / 2, depth / 2]}>
      <boxGeometry args={[width, height, depth]} />
      <meshBasicMaterial color="#334155" wireframe transparent opacity={0.3} />
    </mesh>
  );
}

function AxesLabels() {
  const { inlineCount, crosslineCount, timeSamples, inlineStep, crosslineStep, sampleInterval } = MOCK_DATASET;
  
  return (
    <group>
      <mesh position={[inlineCount * inlineStep + 50, 0, 0]}>
        <sphereGeometry args={[20, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, crosslineCount * crosslineStep + 50, 0]}>
        <sphereGeometry args={[20, 16, 16]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh position={[0, 0, timeSamples * sampleInterval + 50]}>
        <sphereGeometry args={[20, 16, 16]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
    </group>
  );
}

function Horizons() {
  const { horizons } = useInterpretationStore();
  const { inlineCount, crosslineCount, inlineStep, crosslineStep } = MOCK_DATASET;
  
  return (
    <group>
      {horizons.filter(h => h.visible).map((horizon) => {
        const positions = new Float32Array(horizon.points.length * 3);
        horizon.points.forEach((p, i) => {
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
        });
        
        return (
          <points key={horizon.id}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={horizon.points.length}
                array={positions}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial size={15} color={horizon.color} sizeAttenuation transparent opacity={0.8} />
          </points>
        );
      })}
    </group>
  );
}

function Faults() {
  const { faults } = useInterpretationStore();
  
  return (
    <group>
      {faults.filter(f => f.visible).map((fault) => {
        const positions = new Float32Array(fault.vertices.length * 3);
        fault.vertices.forEach((p, i) => {
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
        });
        
        return (
          <points key={fault.id}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={fault.vertices.length}
                array={positions}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial size={12} color={fault.color} sizeAttenuation transparent opacity={0.9} />
          </points>
        );
      })}
    </group>
  );
}

function Scene() {
  const { viewMode, inlineIndex, crosslineIndex, timeIndex } = useViewerStore();
  const { camera } = useThree();
  
  useEffect(() => {
    const { inlineCount, crosslineCount, timeSamples, inlineStep, crosslineStep, sampleInterval } = MOCK_DATASET;
    const centerX = (inlineCount * inlineStep) / 2;
    const centerY = (crosslineCount * crosslineStep) / 2;
    const centerZ = (timeSamples * sampleInterval) / 2;
    const maxDim = Math.max(inlineCount * inlineStep, crosslineCount * crosslineStep, timeSamples * sampleInterval);
    
    camera.position.set(centerX + maxDim * 0.8, centerY - maxDim * 0.8, centerZ + maxDim * 0.6);
    camera.lookAt(centerX, centerY, centerZ);
  }, [camera]);
  
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, -100, 50]} intensity={0.8} />
      
      <VolumeBox />
      <InlineSlice />
      <CrosslineSlice />
      <TimeSlice />
      
      <Horizons />
      <Faults />
      
      <Grid
        position={[MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep / 2, MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep / 2, 0]}
        args={[
          MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep,
          MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep,
        ]}
        cellSize={MOCK_DATASET.inlineStep * 5}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={MOCK_DATASET.inlineStep * 20}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep * 2}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />
      
      <AxesLabels />
      
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={100}
        maxDistance={5000}
      />
      
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
      </GizmoHelper>
    </>
  );
}

interface Viewer3DProps {
  className?: string;
}

function Viewer3DContent({ className }: Viewer3DProps) {
  return (
    <div className={`relative bg-[#0a0a0f] ${className || ''}`}>
      <Canvas
        camera={{ fov: 50, near: 1, far: 10000 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0a0a0f']} />
        <fog attach="fog" args={['#0a0a0f', 2000, 6000]} />
        <Scene />
      </Canvas>
      
      <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-slate-900/80 rounded text-[11px] text-slate-300">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        3D 视图
      </div>
      
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-slate-900/80 rounded text-[10px] text-slate-400 font-mono">
        左键旋转 · 滚轮缩放 · 右键平移
      </div>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class Viewer3DErrorBoundary extends Component<{ children: ReactNode; className?: string }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; className?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.warn('3D Viewer error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`relative bg-[#0a0a0f] flex flex-col items-center justify-center ${this.props.className || ''}`}>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </div>
            <h3 className="text-slate-300 text-sm font-medium mb-1">3D 视图不可用</h3>
            <p className="text-slate-500 text-xs max-w-xs">
              当前环境不支持 WebGL，3D 视图无法加载。<br />
              请使用支持 WebGL 的现代浏览器查看。
            </p>
          </div>
          <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-slate-900/80 rounded text-[11px] text-slate-400">
            <div className="w-2 h-2 rounded-full bg-slate-600" />
            3D 视图
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Viewer3D({ className }: Viewer3DProps) {
  return (
    <Viewer3DErrorBoundary className={className}>
      <Viewer3DContent className={className} />
    </Viewer3DErrorBoundary>
  );
}
