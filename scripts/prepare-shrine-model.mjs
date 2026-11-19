// One-time preparation of the user-supplied FBX. Runtime/build need only the resulting GLB.
// Input: extracted MSJJKCC.fbx + JPEGs from prepare-shrine-textures.ps1.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const directory = process.argv[2];
if (!directory) throw new Error('Usage: node scripts/prepare-shrine-model.mjs <extracted-model-directory>');
// FBX texture definitions are incompatible with Three's material importer. Rebuild them below.
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const input = readFileSync(join(directory, 'MSJJKCC.fbx'));
const scene = new FBXLoader().parse(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
scene.updateMatrixWorld(true);
const meshes = []; scene.traverse(object => { if (object.isMesh) meshes.push(object); });
if (meshes.length !== 1 || meshes[0].material.length !== 5) throw new Error('Unexpected source mesh/material layout');
const source = meshes[0];
const geometry = mergeVertices(source.geometry.clone().applyMatrix4(source.matrixWorld), 1e-5);
geometry.computeBoundingBox();
const box = geometry.boundingBox, center = box.getCenter(new THREE.Vector3());
// Grounded, centered and 12 units wide. Preserve normals, UVs and all original triangles.
geometry.translate(-center.x, -box.min.y, -center.z); geometry.scale(12 / (box.max.x - box.min.x), 12 / (box.max.x - box.min.x), 12 / (box.max.x - box.min.x));
// The source entrance faces -Z; our training audience/camera is on +Z.
geometry.rotateY(Math.PI);
// glTF textures use the opposite vertical UV convention from FBX/TextureLoader.
const uv = geometry.getAttribute('uv');
for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
geometry.computeBoundingBox();

const chunks = [], bufferViews = [], accessors = [];
let offset = 0;
function view(data, target) {
  const bytes = Buffer.from(data.buffer ?? data, data.byteOffset ?? 0, data.byteLength ?? data.length);
  const id = bufferViews.length; bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
  chunks.push(bytes); offset += bytes.length;
  const padding = (4 - offset % 4) % 4; if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
  return id;
}
function attribute(name, type) {
  const a = geometry.getAttribute(name), id = accessors.length;
  accessors.push({ bufferView: view(a.array, 34962), componentType: 5126, count: a.count, type,
    ...(name === 'position' ? { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() } : {}) });
  return id;
}
const attributes = { POSITION: attribute('position', 'VEC3'), NORMAL: attribute('normal', 'VEC3'), TEXCOORD_0: attribute('uv', 'VEC2') };
const primitives = geometry.groups.map(group => {
  const indices = new Uint32Array(geometry.index.array.slice(group.start, group.start + group.count));
  const id = accessors.length;
  accessors.push({ bufferView: view(indices, 34963), componentType: 5125, count: indices.length, type: 'SCALAR' });
  return { attributes, indices: id, material: group.materialIndex, mode: 4 };
});
const images = [], textures = [], materials = [];
for (const [i, letter] of [...'ABCDE'].entries()) {
  const image = channel => {
    const id = images.length;
    images.push({ name: `${letter}_${channel}`, bufferView: view(readFileSync(join(directory, `T_SQ_MalevolentShrine_01${letter}_${channel}.jpg`))), mimeType: 'image/jpeg' });
    textures.push({ source: id, sampler: 0 }); return id;
  };
  materials.push({ name: ['Roof and timber', 'Bones and ribs', 'Mouth', 'Foundation', 'Skulls'][i],
    pbrMetallicRoughness: { baseColorTexture: { index: image('C') }, metallicFactor: 0, roughnessFactor: .84 },
    normalTexture: { index: image('N'), scale: .65 }, doubleSided: true });
}
const gltf = { asset: { version: '2.0', generator: 'Jujutsu Gesture Lab: user-supplied shrine preparation',
  copyright: 'Original model: Byking Inc.; revamp: Groveruke (credits in supplied archive)' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Malevolent Shrine', mesh: 0 }], meshes: [{ primitives }],
  buffers: [{ byteLength: offset }], bufferViews, accessors, images, textures, materials,
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }] };
const rawJson = Buffer.from(JSON.stringify(gltf)), json = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 32); rawJson.copy(json);
const binary = Buffer.concat(chunks), header = Buffer.alloc(12), jHeader = Buffer.alloc(8), bHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
jHeader.writeUInt32LE(json.length); jHeader.writeUInt32LE(0x4e4f534a, 4);
bHeader.writeUInt32LE(binary.length); bHeader.writeUInt32LE(0x004e4942, 4);
const output = resolve('public/assets/shrine'); mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'malevolent-shrine.glb'), Buffer.concat([header, jHeader, json, bHeader, binary]));
console.log(JSON.stringify({ triangles: geometry.index.count / 3, vertices: geometry.attributes.position.count,
  materials: materials.length, bounds: geometry.boundingBox, bytes: header.readUInt32LE(8) }, null, 2));
