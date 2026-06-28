import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';

// ──────────────────────────────────────────────────────────────────────────
// HeroScene
// Khối 3D nhỏ trang trí cho khu hero trang Home (customer). Dựng một "tô món
// ăn" CÁCH ĐIỆU bằng các primitive của three.js (cylinder + torus + sphere) —
// KHÔNG dùng file .glb để đảm bảo nhẹ, miễn phí, không lo bản quyền.
//
// Hiệu năng: dpr giới hạn [1, 1.5], chỉ vài mesh, không tải HDR/Environment
// (không gọi mạng). Component cha (Home) chịu trách nhiệm CHỈ mount khi màn
// đủ rộng và người dùng không bật "giảm chuyển động" (prefers-reduced-motion).
// Đây là lớp trình bày thuần tuý, không đụng dữ liệu/logic.
// ──────────────────────────────────────────────────────────────────────────

// Tô món ăn cách điệu: tự xoay chậm để tạo cảm giác sống động, không chói mắt.
function StylizedBowl() {
  const group = useRef();
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.4;
  });

  // Vài viên "topping" đặt quanh miệng tô cho sinh động.
  const toppings = [
    { pos: [-0.4, 0.28, 0.32], color: '#34A853' },
    { pos: [0.46, 0.28, -0.1], color: '#FBBC05' },
    { pos: [0.02, 0.32, -0.46], color: '#34A853' },
  ];

  return (
    <group ref={group} rotation={[0.5, 0, 0]}>
      {/* Thân tô (màu cam thương hiệu customer #FF6B35) */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[1.1, 0.7, 0.7, 48]} />
        <meshStandardMaterial color="#FF6B35" roughness={0.35} metalness={0.1} />
      </mesh>
      {/* Viền miệng tô (tông cam nhạt) */}
      <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.12, 24, 64]} />
        <meshStandardMaterial color="#FFD6C7" roughness={0.4} />
      </mesh>
      {toppings.map((t, i) => (
        <mesh key={i} position={t.pos}>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color={t.color} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4.2], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      {/* Ánh sáng dịu để tô nổi khối nhưng không gắt */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 2]} intensity={1.1} />
      {/* Float của drei tạo hiệu ứng lơ lửng nhẹ nhàng */}
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.8}>
        <StylizedBowl />
      </Float>
    </Canvas>
  );
}
