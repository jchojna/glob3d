// Create a sphere geometry for the glow
const glowGeometry = new THREE.SphereGeometry(120, 32, 32);

// Create a custom shader material for the glow
const glowMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  transparent: true,
  uniforms: {
    c: { type: 'f', value: 0 },
    p: { type: 'f', value: 2 },
    glowColor: { type: 'c', value: new THREE.Color(0x00aaff) },
    viewVector: { type: 'v3', value: new THREE.Vector3(0, 0, 500) },
  },
  vertexShader: `
    varying vec3 vVertexWorldPosition;
    varying vec3 vVertexNormal;
    void main() {
        vVertexNormal = normalize(normalMatrix * normal);
        vVertexWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 glowColor;
    uniform float c;
    uniform float p;
    uniform vec3 viewVector;
    varying vec3 vVertexNormal;
    varying vec3 vVertexWorldPosition;
    void main() {
        vec3 vNormal = normalize(vVertexNormal);
        vec3 vViewVector = normalize(viewVector - vVertexWorldPosition);
        float intensity = pow(c - dot(vNormal, vViewVector), p);
        gl_FragColor = vec4(glowColor, intensity);
    }
  `,
});

// Create a mesh for the glow
const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);

// Add the glow mesh to the scene
this.scene.add(glowMesh);
