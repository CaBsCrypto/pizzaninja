import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Outlines, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { PizzaState } from '../types';

// Temporary type for items
export interface GameItem3D {
  id: string;
  type: 'pizza' | 'bomb';
  x: number; // 0 to 1000 (game coordinates)
  y: number; // 0 to 1000
  rotation: number;
  radius: number;
  isSliced?: boolean;
}

const GAME_WIDTH = 1000;
const GAME_HEIGHT = 1000;

// Convert 2D game coordinates to 3D world space coordinates
// The camera is looking at Z=0. We'll map (0,0) to (-10, 10) and (1000,1000) to (10, -10)
function mapTo3D(val: number, max: number, range: number) {
  return (val / max) * range - (range / 2);
}

function CelPizza({ item }: { item: any }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      // Map game coords (0-1000) to 3D coords (-10 to 10)
      meshRef.current.position.x = mapTo3D(item.x, GAME_WIDTH, 20);
      meshRef.current.position.y = -mapTo3D(item.y, GAME_HEIGHT, 20); // Y is inverted in 2D canvas vs 3D
      meshRef.current.rotation.z = item.rotation;
      meshRef.current.rotation.x += 0.05; // Spin for 3D effect
      meshRef.current.rotation.y += 0.02;
      
      // If sliced, maybe scale down or hide, as 2D will draw the halves for now
      // We removed the scale.set(0,0,0) because we will render the halves with CSG now!
    }
  });

  const isHalf = item.state === PizzaState.Half;

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[0.8, 0.8, 0.2, 32]} />
      <meshToonMaterial color="#fca5a5" />
      <Outlines thickness={0.05} color="black" />
    </mesh>
  );
}

function CelBomb({ item }: { item: any }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.x = mapTo3D(item.x, GAME_WIDTH, 20);
      meshRef.current.position.y = -mapTo3D(item.y, GAME_HEIGHT, 20);
      meshRef.current.rotation.z = item.rotation;
    }
  });

  const isHalf = item.state === PizzaState.Half;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.7, 32, 32]} />
      <meshToonMaterial color="#1e293b" />
      <Outlines thickness={0.08} color="black" />
      {/* Bomb fuse only if it's not cut, or maybe still attached? */}
      {!isHalf && (
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.4, 8]} />
          <meshToonMaterial color="#b45309" />
        </mesh>
      )}
    </mesh>
  );
}

// The main 3D Scene
export default function GameScene3D({ gameStateRef }: { gameStateRef: React.MutableRefObject<any> }) {
  // We use useFrame inside children to track positions, but for the array itself 
  // R3F doesn't auto-trigger re-renders when a ref mutates.
  // For this PoC, we will force a simple re-render interval to spawn/despawn items, 
  // or rely on React state if we want perfect sync. To avoid performance hits, 
  // we'll use a local state synced to the ref for the array length.
  
  const [items, setItems] = React.useState<any[]>([]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      // Only trigger a re-render if the number of items changed (spawn/despawn)
      // The actual X/Y positions are updated inside CelPizza via useFrame reading the ref directly!
      setItems((prev) => {
        const currentItems = gameStateRef.current.items;
        if (prev.length !== currentItems.length || prev.some((p, i) => p.id !== currentItems[i]?.id)) {
          return [...currentItems];
        }
        return prev;
      });
    }, 100); // 10fps array sync is fine, objects move at 60fps via useFrame
    return () => clearInterval(interval);
  }, [gameStateRef]);

  return (
    <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 50, near: 0.1, far: 100 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />
      <Environment preset="city" />
      
      {/* Render Items */}
      {items.map((item) => (
        item.type === 'pizza' ? <CelPizza key={item.id} item={item} /> : <CelBomb key={item.id} item={item} />
      ))}
    </Canvas>
  );
}
