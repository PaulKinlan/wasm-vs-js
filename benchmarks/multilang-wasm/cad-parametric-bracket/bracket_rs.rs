#![no_std]
// Faithful no_std port of benchmarks/base/cad-parametric-bracket/bracket.c
// Bit-identical to the JS oracle (same ops, same order).

use core::f64;

const INPUT_BYTES: usize = 128;
const OUTPUT_CAPACITY: usize = 2097152;
const INPUT_MAGIC: u32 = 0x31425243;
const OUTPUT_MAGIC: u32 = 0x314f5242;
const HEADER_BYTES: usize = 256;
const MAX_LOOPS: usize = 3;
const MAX_POINTS: usize = 40;
const MAX_SEGMENTS: usize = 104;
const MAX_TRIANGLES: usize = 20000;
const MAX_BREP_VERTICES: usize = 24;
const MAX_BREP_EDGES: usize = 36;
const MAX_BREP_FACES: usize = 16;
const MAX_BREP_LOOPS: usize = 20;
const MAX_BREP_COEDGES: usize = 72;
const MAX_FACE_LOOPS: usize = 3;
const MAX_LOOP_COEDGES: usize = 8;

type u8v = u8;
type u32v = u32;
type i32v = i32;
type u64v = u64;

#[derive(Clone, Copy, Default)]
struct P2 {
    x: f64,
    y: f64,
}
#[derive(Clone, Copy, Default)]
struct Segment {
    a: P2,
    b: P2,
}
#[derive(Clone, Copy, Default)]
struct Hit {
    edge: u32,
    x: f64,
}
#[derive(Clone, Copy, PartialEq)]
enum SurfaceKind {
    Plane = 1,
    Cylinder = 2,
}
#[derive(Clone, Copy, PartialEq)]
enum CurveKind {
    Line = 1,
    Circle = 2,
}
#[derive(Clone, Copy, Default)]
struct BrepVertex {
    x: f64,
    y: f64,
    z: f64,
}
#[derive(Clone, Copy, Default)]
struct BrepEdge {
    curve: u32,
    v0: u32,
    v1: u32,
    start_index: u32,
    steps: u32,
    coedges: [u32; 2],
    coedge_count: u32,
    cx: f64,
    cy: f64,
    radius: f64,
}
#[derive(Clone, Copy, Default)]
struct BrepFace {
    surface: u32,
    loops: [u32; MAX_FACE_LOOPS],
    loop_count: u32,
    cx: f64,
    cy: f64,
    radius: f64,
}
#[derive(Clone, Copy, Default)]
struct BrepLoop {
    face: u32,
    coedges: [u32; MAX_LOOP_COEDGES],
    coedge_count: u32,
}
#[derive(Clone, Copy, Default)]
struct BrepCoedge {
    edge: u32,
    face: u32,
    loop_id: u32,
    next: u32,
    previous: u32,
    orientation: i32,
}
#[derive(Clone, Copy)]
struct BrepSolid {
    vertices: [BrepVertex; MAX_BREP_VERTICES],
    edges: [BrepEdge; MAX_BREP_EDGES],
    faces: [BrepFace; MAX_BREP_FACES],
    brep_loops: [BrepLoop; MAX_BREP_LOOPS],
    coedges: [BrepCoedge; MAX_BREP_COEDGES],
    vertex_count: u32,
    edge_count: u32,
    face_count: u32,
    loop_count: u32,
    coedge_count: u32,
    hole_count: u32,
    feature_nodes: u64,
    box_solids: u64,
    cylinder_solids: u64,
    boolean_cuts: u64,
    fillet_edges: u64,
}
#[derive(Clone, Copy, Default)]
struct BrepTopology {
    connected_components: u32,
    shells: u32,
    genus: u32,
    euler_characteristic: i32,
}

static mut INPUT_DATA: [u8v; INPUT_BYTES] = [0; INPUT_BYTES];
static mut OUTPUT_DATA: [u8v; OUTPUT_CAPACITY] = [0; OUTPUT_CAPACITY];
static mut LOOPS: [[P2; MAX_POINTS]; MAX_LOOPS] = [[P2 { x: 0.0, y: 0.0 }; MAX_POINTS]; MAX_LOOPS];
static mut LOOP_LENGTHS: [u32; MAX_LOOPS] = [0; MAX_LOOPS];
static mut EDGE_DATA: [Segment; MAX_SEGMENTS] = [Segment { a: P2 { x: 0.0, y: 0.0 }, b: P2 { x: 0.0, y: 0.0 } }; MAX_SEGMENTS];
static mut TRIANGLE_DATA: [f64; MAX_TRIANGLES * 9] = [0.0; MAX_TRIANGLES * 9];
static mut YS: [f64; MAX_SEGMENTS] = [0.0; MAX_SEGMENTS];
static mut XS: [f64; MAX_SEGMENTS] = [0.0; MAX_SEGMENTS];
static mut BOTTOM_CUTS: [f64; MAX_SEGMENTS + 2] = [0.0; MAX_SEGMENTS + 2];
static mut TOP_CUTS: [f64; MAX_SEGMENTS + 2] = [0.0; MAX_SEGMENTS + 2];
static mut HITS: [Hit; MAX_SEGMENTS] = [Hit { edge: 0, x: 0.0 }; MAX_SEGMENTS];
static mut BREP: BrepSolid = BrepSolid { vertices: [BrepVertex { x: 0.0, y: 0.0, z: 0.0 }; MAX_BREP_VERTICES], edges: [BrepEdge { curve: 0, v0: 0, v1: 0, start_index: 0, steps: 0, coedges: [0; 2], coedge_count: 0, cx: 0.0, cy: 0.0, radius: 0.0 }; MAX_BREP_EDGES], faces: [BrepFace { surface: 0, loops: [0; MAX_FACE_LOOPS], loop_count: 0, cx: 0.0, cy: 0.0, radius: 0.0 }; MAX_BREP_FACES], brep_loops: [BrepLoop { face: 0, coedges: [0; MAX_LOOP_COEDGES], coedge_count: 0 }; MAX_BREP_LOOPS], coedges: [BrepCoedge { edge: 0, face: 0, loop_id: 0, next: 0, previous: 0, orientation: 0 }; MAX_BREP_COEDGES], vertex_count: 0, edge_count: 0, face_count: 0, loop_count: 0, coedge_count: 0, hole_count: 0, feature_nodes: 0, box_solids: 0, cylinder_solids: 0, boolean_cuts: 0, fillet_edges: 0 };
static mut CYLINDER_TOOL: BrepSolid = BREP_INIT;

static BREP_INIT: BrepSolid = BrepSolid { vertices: [BrepVertex { x: 0.0, y: 0.0, z: 0.0 }; MAX_BREP_VERTICES], edges: [BrepEdge { curve: 0, v0: 0, v1: 0, start_index: 0, steps: 0, coedges: [0; 2], coedge_count: 0, cx: 0.0, cy: 0.0, radius: 0.0 }; MAX_BREP_EDGES], faces: [BrepFace { surface: 0, loops: [0; MAX_FACE_LOOPS], loop_count: 0, cx: 0.0, cy: 0.0, radius: 0.0 }; MAX_BREP_FACES], brep_loops: [BrepLoop { face: 0, coedges: [0; MAX_LOOP_COEDGES], coedge_count: 0 }; MAX_BREP_LOOPS], coedges: [BrepCoedge { edge: 0, face: 0, loop_id: 0, next: 0, previous: 0, orientation: 0 }; MAX_BREP_COEDGES], vertex_count: 0, edge_count: 0, face_count: 0, loop_count: 0, coedge_count: 0, hole_count: 0, feature_nodes: 0, box_solids: 0, cylinder_solids: 0, boolean_cuts: 0, fillet_edges: 0 };

static UX: [f64; 32] = [
  1.0, 0.9807852804032304, 0.9238795325112867, 0.8314696123025452, 0.7071067811865476,
  0.5555702330196023, 0.38268343236508984, 0.19509032201612833, 0.0, -0.19509032201612833,
  -0.38268343236508984, -0.5555702330196023, -0.7071067811865476, -0.8314696123025452,
  -0.9238795325112867, -0.9807852804032304, -1.0, -0.9807852804032304, -0.9238795325112867,
  -0.8314696123025452, -0.7071067811865476, -0.5555702330196023, -0.38268343236508984,
  -0.19509032201612833, 0.0, 0.19509032201612833, 0.38268343236508984, 0.5555702330196023,
  0.7071067811865476, 0.8314696123025452, 0.9238795325112867, 0.9807852804032304,
];
static UY: [f64; 32] = [
  0.0, 0.19509032201612825, 0.3826834323650898, 0.5555702330196022, 0.7071067811865475,
  0.8314696123025452, 0.9238795325112867, 0.9807852804032304, 1.0, 0.9807852804032304,
  0.9238795325112867, 0.8314696123025452, 0.7071067811865475, 0.5555702330196022,
  0.3826834323650898, 0.19509032201612825, 0.0, -0.19509032201612825, -0.3826834323650898,
  -0.5555702330196022, -0.7071067811865475, -0.8314696123025452, -0.9238795325112867,
  -0.9807852804032304, -1.0, -0.9807852804032304, -0.9238795325112867, -0.8314696123025452,
  -0.7071067811865475, -0.5555702330196022, -0.3826834323650898, -0.19509032201612825,
];

#[no_mangle]
pub extern "C" fn input_ptr() -> u32 {
    unsafe { &INPUT_DATA as *const [u8v; INPUT_BYTES] as *const u8v as u32 }
}
#[no_mangle]
pub extern "C" fn output_ptr() -> u32 {
    unsafe { &OUTPUT_DATA as *const [u8v; OUTPUT_CAPACITY] as *const u8v as u32 }
}

unsafe fn read_u32(off: u32) -> u32 {
    u32::from_le_bytes([
        INPUT_DATA[off as usize],
        INPUT_DATA[off as usize + 1],
        INPUT_DATA[off as usize + 2],
        INPUT_DATA[off as usize + 3],
    ])
}
unsafe fn read_f64(off: u32) -> f64 {
    f64::from_le_bytes([
        INPUT_DATA[off as usize],
        INPUT_DATA[off as usize + 1],
        INPUT_DATA[off as usize + 2],
        INPUT_DATA[off as usize + 3],
        INPUT_DATA[off as usize + 4],
        INPUT_DATA[off as usize + 5],
        INPUT_DATA[off as usize + 6],
        INPUT_DATA[off as usize + 7],
    ])
}
unsafe fn write_u32(off: u32, value: u32) {
    let b = value.to_le_bytes();
    for i in 0..4 {
        OUTPUT_DATA[off as usize + i] = b[i];
    }
}
unsafe fn write_i32(off: u32, value: i32) {
    let b = value.to_le_bytes();
    for i in 0..4 {
        OUTPUT_DATA[off as usize + i] = b[i];
    }
}
unsafe fn write_u64(off: u32, value: u64) {
    let b = value.to_le_bytes();
    for i in 0..8 {
        OUTPUT_DATA[off as usize + i] = b[i];
    }
}
unsafe fn write_f64(off: u32, value: f64) {
    let b = value.to_le_bytes();
    for i in 0..8 {
        OUTPUT_DATA[off as usize + i] = b[i];
    }
}
fn finite_value(value: f64) -> u32 {
    let e = if value == value && value <= 1.7976931348623157e308 && value >= -1.7976931348623157e308 { 1 } else { 0 };
    e
}
unsafe fn point(loop_i: usize, cursor: &mut u32, x: f64, y: f64) {
    LOOPS[loop_i][*cursor as usize].x = x;
    LOOPS[loop_i][*cursor as usize].y = y;
    *cursor += 1;
}
unsafe fn init_solid(solid: &mut BrepSolid) {
    solid.vertex_count = 0;
    solid.edge_count = 0;
    solid.face_count = 0;
    solid.loop_count = 0;
    solid.coedge_count = 0;
    solid.hole_count = 0;
    solid.feature_nodes = 0;
    solid.box_solids = 0;
    solid.cylinder_solids = 0;
    solid.boolean_cuts = 0;
    solid.fillet_edges = 0;
    for i in 0..MAX_BREP_EDGES {
        solid.edges[i].coedge_count = 0;
    }
    for i in 0..MAX_BREP_FACES {
        solid.faces[i].loop_count = 0;
    }
}
unsafe fn add_vertex(solid: &mut BrepSolid, x: f64, y: f64, z: f64) -> u32 {
    let id = solid.vertex_count;
    solid.vertex_count += 1;
    solid.vertices[id as usize].x = x;
    solid.vertices[id as usize].y = y;
    solid.vertices[id as usize].z = z;
    id
}
unsafe fn add_face(solid: &mut BrepSolid, surface: u32, cx: f64, cy: f64, radius: f64) -> u32 {
    let id = solid.face_count;
    solid.face_count += 1;
    solid.faces[id as usize].surface = surface;
    solid.faces[id as usize].cx = cx;
    solid.faces[id as usize].cy = cy;
    solid.faces[id as usize].radius = radius;
    solid.faces[id as usize].loop_count = 0;
    id
}
unsafe fn configure_edge(
    solid: &mut BrepSolid,
    id: u32,
    curve: u32,
    v0: u32,
    v1: u32,
    cx: f64,
    cy: f64,
    radius: f64,
    start: u32,
    steps: u32,
) {
    let e = &mut solid.edges[id as usize];
    e.curve = curve;
    e.v0 = v0;
    e.v1 = v1;
    e.cx = cx;
    e.cy = cy;
    e.radius = radius;
    e.start_index = start;
    e.steps = steps;
    e.coedge_count = 0;
}
unsafe fn add_edge(
    solid: &mut BrepSolid,
    curve: u32,
    v0: u32,
    v1: u32,
    cx: f64,
    cy: f64,
    radius: f64,
    start: u32,
    steps: u32,
) -> u32 {
    let id = solid.edge_count;
    solid.edge_count += 1;
    configure_edge(solid, id, curve, v0, v1, cx, cy, radius, start, steps);
    id
}
unsafe fn add_loop(
    solid: &mut BrepSolid,
    face: u32,
    edge_ids: &[u32],
    orientations: &[i32],
    count: u32,
) -> u32 {
    let loop_id = solid.loop_count;
    solid.loop_count += 1;
    let l = &mut solid.brep_loops[loop_id as usize];
    l.face = face;
    l.coedge_count = count;
    solid.faces[face as usize].loops[solid.faces[face as usize].loop_count as usize] = loop_id;
    solid.faces[face as usize].loop_count += 1;
    for i in 0..count as usize {
        let coedge_id = solid.coedge_count;
        solid.coedge_count += 1;
        let c = &mut solid.coedges[coedge_id as usize];
        c.edge = edge_ids[i];
        c.face = face;
        c.loop_id = loop_id;
        c.orientation = orientations[i];
        l.coedges[i] = coedge_id;
        let e = &mut solid.edges[edge_ids[i] as usize];
        e.coedges[e.coedge_count as usize] = coedge_id;
        e.coedge_count += 1;
    }
    for i in 0..count as usize {
        let c = &mut solid.coedges[l.coedges[i] as usize];
        c.previous = l.coedges[(i + count as usize - 1) % count as usize];
        c.next = l.coedges[(i + 1) % count as usize];
    }
    loop_id
}
unsafe fn reset_incidence(solid: &mut BrepSolid) {
    solid.loop_count = 0;
    solid.coedge_count = 0;
    for i in 0..solid.edge_count as usize {
        solid.edges[i].coedge_count = 0;
    }
    for i in 0..solid.face_count as usize {
        solid.faces[i].loop_count = 0;
    }
}
unsafe fn make_box_solid(solid: &mut BrepSolid, w: f64, h: f64, depth: f64) {
    init_solid(solid);
    let px = [0.0, w, w, 0.0];
    let py = [0.0, 0.0, h, h];
    for z in 0..2 {
        for i in 0..4 {
            add_vertex(solid, px[i], py[i], if z != 0 { depth } else { 0.0 });
        }
    }
    let bottom = add_face(solid, 1, 0.0, 0.0, 0.0);
    let top = add_face(solid, 1, 0.0, 0.0, 0.0);
    let mut sides = [0u32; 4];
    for i in 0..4 {
        sides[i] = add_face(solid, 1, 0.0, 0.0, 0.0);
    }
    let mut bottom_edges = [0u32; 4];
    let mut top_edges = [0u32; 4];
    let mut vertical = [0u32; 4];
    for i in 0..4 {
        bottom_edges[i] = add_edge(solid, 1, i as u32, (i as u32 + 1) % 4, 0.0, 0.0, 0.0, 0, 0);
        top_edges[i] = add_edge(solid, 1, 4 + i as u32, 4 + (i as u32 + 1) % 4, 0.0, 0.0, 0.0, 0, 0);
        vertical[i] = add_edge(solid, 1, i as u32, 4 + i as u32, 0.0, 0.0, 0.0, 0, 0);
    }
    let bottom_loop = [bottom_edges[3], bottom_edges[2], bottom_edges[1], bottom_edges[0]];
    let negative = [-1, -1, -1, -1];
    let positive = [1, 1, 1, 1];
    add_loop(solid, bottom, &bottom_loop, &negative, 4);
    add_loop(solid, top, &top_edges, &positive, 4);
    for i in 0..4 {
        let side_loop = [bottom_edges[i], vertical[(i + 1) % 4], top_edges[i], vertical[i]];
        let side_orientation = [1, 1, -1, -1];
        add_loop(solid, sides[i], &side_loop, &side_orientation, 4);
    }
    solid.feature_nodes += 1;
    solid.box_solids += 1;
}
unsafe fn make_cylinder_solid(tool: &mut BrepSolid, cx: f64, cy: f64, radius: f64, depth: f64) {
    init_solid(tool);
    let v0 = add_vertex(tool, cx + radius, cy, 0.0);
    let v1 = add_vertex(tool, cx + radius, cy, depth);
    let bottom = add_face(tool, 1, 0.0, 0.0, 0.0);
    let top = add_face(tool, 1, 0.0, 0.0, 0.0);
    let wall = add_face(tool, 2, cx, cy, radius);
    let rim0 = add_edge(tool, 2, v0, v0, cx, cy, radius, 0, 32);
    let rim1 = add_edge(tool, 2, v1, v1, cx, cy, radius, 0, 32);
    let seam = add_edge(tool, 1, v0, v1, 0.0, 0.0, 0.0, 0, 0);
    let one = [rim0];
    let orientation = [-1];
    add_loop(tool, bottom, &one, &orientation, 1);
    let one = [rim1];
    let orientation = [1];
    add_loop(tool, top, &one, &orientation, 1);
    let wall_edges = [rim0, seam, rim1, seam];
    let wall_orientation = [1, 1, -1, -1];
    add_loop(tool, wall, &wall_edges, &wall_orientation, 4);
    tool.feature_nodes += 1;
    tool.cylinder_solids += 1;
}
unsafe fn validate_brep(solid: &BrepSolid, topology: &mut BrepTopology) -> u32 {
    if solid.face_count == 0 {
        return 0;
    }
    for edge in 0..solid.edge_count {
        let item = &solid.edges[edge as usize];
        if item.v0 >= solid.vertex_count || item.v1 >= solid.vertex_count || item.coedge_count != 2 {
            return 0;
        }
        let a = &solid.coedges[item.coedges[0] as usize];
        let b = &solid.coedges[item.coedges[1] as usize];
        if a.edge != edge || b.edge != edge || a.orientation + b.orientation != 0 {
            return 0;
        }
    }
    for face in 0..solid.face_count {
        let item = &solid.faces[face as usize];
        if item.loop_count == 0 {
            return 0;
        }
        for li in 0..item.loop_count {
            let loop_id = item.loops[li as usize];
            if loop_id >= solid.loop_count {
                return 0;
            }
            let l = &solid.brep_loops[loop_id as usize];
            if l.face != face || l.coedge_count == 0 {
                return 0;
            }
            for i in 0..l.coedge_count as usize {
                let id = l.coedges[i];
                if id >= solid.coedge_count {
                    return 0;
                }
                let c = &solid.coedges[id as usize];
                let count = l.coedge_count as usize;
                if c.face != face
                    || c.loop_id != loop_id
                    || c.previous != l.coedges[(i + count - 1) % count]
                    || c.next != l.coedges[(i + 1) % count]
                {
                    return 0;
                }
            }
        }
    }
    let mut visited = [0u32; MAX_BREP_FACES];
    let mut components = 0u32;
    for start in 0..solid.face_count {
        if visited[start as usize] != 0 {
            continue;
        }
        let mut queue = [0u32; MAX_BREP_FACES];
        let mut head = 0usize;
        let mut tail = 0usize;
        queue[tail] = start;
        tail += 1;
        visited[start as usize] = 1;
        components += 1;
        while head < tail {
            let face = queue[head];
            head += 1;
            for edge in 0..solid.edge_count {
                let item = &solid.edges[edge as usize];
                let a = solid.coedges[item.coedges[0] as usize].face;
                let b = solid.coedges[item.coedges[1] as usize].face;
                let next = if a == face {
                    b
                } else if b == face {
                    a
                } else {
                    MAX_BREP_FACES as u32
                };
                if next < solid.face_count && visited[next as usize] == 0 {
                    visited[next as usize] = 1;
                    queue[tail] = next;
                    tail += 1;
                }
            }
        }
    }
    let euler = solid.vertex_count as i32 - solid.edge_count as i32 + solid.face_count as i32
        - (solid.loop_count as i32 - solid.face_count as i32);
    let twice_genus = 2i32 * components as i32 - euler;
    if twice_genus < 0 || (twice_genus & 1) != 0 {
        return 0;
    }
    topology.connected_components = components;
    topology.shells = components;
    topology.euler_characteristic = euler;
    topology.genus = (twice_genus / 2) as u32;
    1
}
unsafe fn boolean_cut(
    solid: &mut BrepSolid,
    tool: &BrepSolid,
    w: f64,
    h: f64,
    fillet: f64,
    boolean_tests: &mut u64,
) -> u32 {
    let mut tool_topology = BrepTopology::default();
    if validate_brep(tool, &mut tool_topology) == 0 || tool_topology.genus != 0 {
        return 0;
    }
    let cylinder = &tool.faces[2];
    let cx = cylinder.cx;
    let cy = cylinder.cy;
    let radius = cylinder.radius;
    for k in 0..32 {
        let x = cx + radius * UX[k];
        let y = cy + radius * UY[k];
        let qx = if x < fillet {
            fillet - x
        } else if x > w - fillet {
            x - (w - fillet)
        } else {
            0.0
        };
        let qy = if y < fillet {
            fillet - y
        } else if y > h - fillet {
            y - (h - fillet)
        } else {
            0.0
        };
        *boolean_tests += 1;
        if x < 0.0 || x > w || y < 0.0 || y > h || qx * qx + qy * qy > fillet * fillet + 1e-15 {
            return 0;
        }
    }
    let v0 = add_vertex(solid, tool.vertices[0].x, tool.vertices[0].y, tool.vertices[0].z);
    let v1 = add_vertex(solid, tool.vertices[1].x, tool.vertices[1].y, tool.vertices[1].z);
    let wall = add_face(solid, 2, cx, cy, radius);
    let rim0 = add_edge(solid, 2, v0, v0, cx, cy, radius, 0, 32);
    let rim1 = add_edge(solid, 2, v1, v1, cx, cy, radius, 0, 32);
    let seam = add_edge(solid, 1, v0, v1, 0.0, 0.0, 0.0, 0, 0);
    let one = [rim0];
    let orientation = [1];
    add_loop(solid, 0, &one, &orientation, 1);
    let one = [rim1];
    let orientation = [-1];
    add_loop(solid, 1, &one, &orientation, 1);
    let wall_edges = [rim0, seam, rim1, seam];
    let wall_orientation = [-1, 1, 1, -1];
    add_loop(solid, wall, &wall_edges, &wall_orientation, 4);
    solid.hole_count += 1;
    solid.feature_nodes += 2;
    solid.cylinder_solids += 1;
    solid.boolean_cuts += 1;
    let mut topology = BrepTopology::default();
    validate_brep(solid, &mut topology)
}
unsafe fn profile_point(i: u32, w: f64, h: f64, r: f64) -> P2 {
    let px = [r, w - r, w, w, w - r, r, 0.0, 0.0];
    let py = [0.0, 0.0, r, h - r, h, h, h - r, r];
    P2 {
        x: px[i as usize],
        y: py[i as usize],
    }
}
unsafe fn profile_curve(i: u32, w: f64, h: f64, r: f64, cx: &mut f64, cy: &mut f64, start: &mut u32) {
    *cx = 0.0;
    *cy = 0.0;
    *start = 0;
    if i == 1 {
        *cx = w - r;
        *cy = r;
        *start = 24;
    } else if i == 3 {
        *cx = w - r;
        *cy = h - r;
        *start = 0;
    } else if i == 5 {
        *cx = r;
        *cy = h - r;
        *start = 8;
    } else if i == 7 {
        *cx = r;
        *cy = r;
        *start = 16;
    }
}
unsafe fn fillet_vertical_edges(
    solid: &mut BrepSolid,
    w: f64,
    h: f64,
    depth: f64,
    radius: f64,
) -> u32 {
    if radius == 0.0 {
        return 1;
    }
    let holes = solid.hole_count;
    let mut bottom_vertices = [0u32; 8];
    let mut top_vertices = [4u32; 8];
    for i in 1..8 {
        let p = profile_point(i, w, h, radius);
        if (i & 1) == 0 {
            bottom_vertices[i as usize] = i / 2;
            top_vertices[i as usize] = 4 + i / 2;
        } else {
            bottom_vertices[i as usize] = add_vertex(solid, p.x, p.y, 0.0);
            top_vertices[i as usize] = add_vertex(solid, p.x, p.y, depth);
        }
    }
    for i in (0..8).step_by(2) {
        let p = profile_point(i, w, h, radius);
        solid.vertices[bottom_vertices[i as usize] as usize].x = p.x;
        solid.vertices[bottom_vertices[i as usize] as usize].y = p.y;
        solid.vertices[bottom_vertices[i as usize] as usize].z = 0.0;
        solid.vertices[top_vertices[i as usize] as usize].x = p.x;
        solid.vertices[top_vertices[i as usize] as usize].y = p.y;
        solid.vertices[top_vertices[i as usize] as usize].z = depth;
    }
    let mut bottom_edges = [0u32; 8];
    let mut top_edges = [0u32; 8];
    let mut vertical = [0u32; 8];
    let mut sides = [0u32; 8];
    for i in 0..8 {
        let next = (i + 1) % 8;
        let mut cx = 0.0;
        let mut cy = 0.0;
        let mut start = 0u32;
        profile_curve(i, w, h, radius, &mut cx, &mut cy, &mut start);
        let curve: u32 = if (i & 1) != 0 { 2 } else { 1 };
        if (i & 1) == 0 {
            bottom_edges[i as usize] = i / 2;
            top_edges[i as usize] = 4 + i / 2;
            vertical[i as usize] = 8 + i / 2;
            sides[i as usize] = 2 + i / 2;
            configure_edge(
                solid,
                bottom_edges[i as usize],
                curve,
                bottom_vertices[i as usize],
                bottom_vertices[next as usize],
                cx,
                cy,
                radius,
                start,
                if curve == 2 { 8 } else { 0 },
            );
            configure_edge(
                solid,
                top_edges[i as usize],
                curve,
                top_vertices[i as usize],
                top_vertices[next as usize],
                cx,
                cy,
                radius,
                start,
                if curve == 2 { 8 } else { 0 },
            );
            configure_edge(
                solid,
                vertical[i as usize],
                1,
                bottom_vertices[i as usize],
                top_vertices[i as usize],
                0.0,
                0.0,
                0.0,
                0,
                0,
            );
            solid.faces[sides[i as usize] as usize].surface = 1;
        } else {
            bottom_edges[i as usize] =
                add_edge(solid, curve, bottom_vertices[i as usize], bottom_vertices[next as usize], cx, cy, radius, start, 8);
            top_edges[i as usize] =
                add_edge(solid, curve, top_vertices[i as usize], top_vertices[next as usize], cx, cy, radius, start, 8);
            vertical[i as usize] =
                add_edge(solid, 1, bottom_vertices[i as usize], top_vertices[i as usize], 0.0, 0.0, 0.0, 0, 0);
            sides[i as usize] = add_face(solid, 2, cx, cy, radius);
            solid.feature_nodes += 1;
            solid.fillet_edges += 1;
        }
    }
    if solid.vertex_count != 16 + 2 * holes
        || solid.edge_count != 24 + 3 * holes
        || solid.face_count != 10 + holes
    {
        return 0;
    }
    reset_incidence(solid);
    let mut reverse_bottom = [0u32; 8];
    let mut negative = [0i32; 8];
    let mut positive = [0i32; 8];
    for i in 0..8 {
        reverse_bottom[i] = bottom_edges[7 - i];
        negative[i] = -1;
        positive[i] = 1;
    }
    add_loop(solid, 0, &reverse_bottom, &negative, 8);
    add_loop(solid, 1, &top_edges, &positive, 8);
    for i in 0..8 {
        let side_loop = [bottom_edges[i], vertical[(i + 1) % 8], top_edges[i], vertical[i]];
        let orientation = [1, 1, -1, -1];
        add_loop(solid, sides[i], &side_loop, &orientation, 4);
    }
    for hole in 0..holes {
        let wall = 6 + hole;
        let edge = 12 + hole * 3;
        let one = [edge];
        let orientation = [1];
        add_loop(solid, 0, &one, &orientation, 1);
        let one = [edge + 1];
        let orientation = [-1];
        add_loop(solid, 1, &one, &orientation, 1);
        let wall_edges = [edge, edge + 2, edge + 1, edge + 2];
        let wall_orientation = [-1, 1, 1, -1];
        add_loop(solid, wall, &wall_edges, &wall_orientation, 4);
    }
    let mut topology = BrepTopology::default();
    validate_brep(solid, &mut topology)
}
unsafe fn construct_face_loops_from_brep(solid: &BrepSolid, face: u32) -> u32 {
    let plane = &solid.faces[face as usize];
    if plane.loop_count > MAX_LOOPS as u32 {
        return 0;
    }
    for li in 0..plane.loop_count as usize {
        let l = &solid.brep_loops[plane.loops[li] as usize];
        let mut cursor = 0u32;
        for ci in 0..l.coedge_count as usize {
            let c = &solid.coedges[l.coedges[ci] as usize];
            let e = &solid.edges[c.edge as usize];
            if e.curve == 1 {
                let vertex = if c.orientation > 0 { e.v0 } else { e.v1 };
                point(
                    li,
                    &mut cursor,
                    solid.vertices[vertex as usize].x,
                    solid.vertices[vertex as usize].y,
                );
            } else if c.orientation > 0 {
                for step in 0..e.steps {
                    let q = ((e.start_index + step) & 31) as usize;
                    point(
                        li,
                        &mut cursor,
                        e.cx + e.radius * UX[q],
                        e.cy + e.radius * UY[q],
                    );
                }
            } else {
                for step in (0..e.steps).rev() {
                    let q = ((e.start_index + step) & 31) as usize;
                    point(
                        li,
                        &mut cursor,
                        e.cx + e.radius * UX[q],
                        e.cy + e.radius * UY[q],
                    );
                }
            }
        }
        LOOP_LENGTHS[li] = cursor;
    }
    plane.loop_count
}
unsafe fn x_at(s: &Segment, y: f64) -> f64 {
    if s.a.y == s.b.y {
        return if s.a.x < s.b.x { s.a.x } else { s.b.x };
    }
    s.a.x + (s.b.x - s.a.x) * ((y - s.a.y) / (s.b.y - s.a.y))
}
unsafe fn add_triangle(
    count: &mut u32,
    ax: f64,
    ay: f64,
    az: f64,
    bx: f64,
    by: f64,
    bz: f64,
    cx: f64,
    cy: f64,
    cz: f64,
) {
    let abx = bx - ax;
    let aby = by - ay;
    let abz = bz - az;
    let acx = cx - ax;
    let acy = cy - ay;
    let acz = cz - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    if nx * nx + ny * ny + nz * nz <= 1e-30 || *count >= MAX_TRIANGLES as u32 {
        return;
    }
    let o = (*count as usize) * 9;
    TRIANGLE_DATA[o] = ax;
    TRIANGLE_DATA[o + 1] = ay;
    TRIANGLE_DATA[o + 2] = az;
    TRIANGLE_DATA[o + 3] = bx;
    TRIANGLE_DATA[o + 4] = by;
    TRIANGLE_DATA[o + 5] = bz;
    TRIANGLE_DATA[o + 6] = cx;
    TRIANGLE_DATA[o + 7] = cy;
    TRIANGLE_DATA[o + 8] = cz;
    *count += 1;
}
unsafe fn tessellate_faces(
    loop_count: u32,
    depth: f64,
    band_count: &mut u64,
    tests: &mut u64,
    comparisons: &mut u64,
) -> u32 {
    let mut edge_count = 0usize;
    let mut y_count = 0usize;
    let mut x_count = 0usize;
    for l in 0..loop_count as usize {
        for i in 0..LOOP_LENGTHS[l] as usize {
            let s = &mut EDGE_DATA[edge_count];
            s.a = LOOPS[l][i];
            s.b = LOOPS[l][(i + 1) % LOOP_LENGTHS[l] as usize];
            edge_count += 1;
            YS[y_count] = LOOPS[l][i].y;
            y_count += 1;
            XS[x_count] = LOOPS[l][i].x;
            x_count += 1;
        }
    }
    for i in 1..y_count {
        let value = YS[i];
        let mut j = i;
        while j > 0 && YS[j - 1] > value {
            YS[j] = YS[j - 1];
            j -= 1;
        }
        YS[j] = value;
    }
    let mut unique = 0usize;
    for i in 0..y_count {
        if i == 0 || YS[i] != YS[i - 1] {
            YS[unique] = YS[i];
            unique += 1;
        }
    }
    for i in 1..x_count {
        let value = XS[i];
        let mut j = i;
        while j > 0 && XS[j - 1] > value {
            XS[j] = XS[j - 1];
            j -= 1;
        }
        XS[j] = value;
    }
    let mut unique_x = 0usize;
    for i in 0..x_count {
        if i == 0 || XS[i] != XS[i - 1] {
            XS[unique_x] = XS[i];
            unique_x += 1;
        }
    }
    let mut tri_count = 0u32;
    let mut band = 0usize;
    while band + 1 < unique {
        let y0 = YS[band];
        let y1 = YS[band + 1];
        if y1 > y0 {
            let mid = (y0 + y1) * 0.5;
            let mut hit_count = 0usize;
            for e in 0..edge_count {
                *tests += 1;
                let s = &EDGE_DATA[e];
                let ay = s.a.y;
                let by = s.b.y;
                if (ay <= mid && mid < by) || (by <= mid && mid < ay) {
                    let value = Hit {
                        edge: e as u32,
                        x: x_at(s, mid),
                    };
                    let mut j = hit_count;
                    hit_count += 1;
                    HITS[j] = value;
                    while j > 0 {
                        *comparisons += 1;
                        if HITS[j - 1].x <= value.x {
                            break;
                        }
                        HITS[j] = HITS[j - 1];
                        j -= 1;
                    }
                    HITS[j] = value;
                }
            }
            if (hit_count & 1) != 0 {
                return 0;
            }
            *band_count += 1;
            let mut i = 0usize;
            while i < hit_count {
                let l = &EDGE_DATA[HITS[i].edge as usize];
                let r = &EDGE_DATA[HITS[i + 1].edge as usize];
                let l0 = x_at(l, y0);
                let l1 = x_at(l, y1);
                let r0 = x_at(r, y0);
                let r1 = x_at(r, y1);
                let mut bottom_count = 0usize;
                let mut top_count = 0usize;
                BOTTOM_CUTS[bottom_count] = l0;
                bottom_count += 1;
                for q in 0..unique_x {
                    if XS[q] > l0 && XS[q] < r0 {
                        BOTTOM_CUTS[bottom_count] = XS[q];
                        bottom_count += 1;
                    }
                }
                if r0 != l0 {
                    BOTTOM_CUTS[bottom_count] = r0;
                    bottom_count += 1;
                }
                TOP_CUTS[top_count] = l1;
                top_count += 1;
                for q in 0..unique_x {
                    if XS[q] > l1 && XS[q] < r1 {
                        TOP_CUTS[top_count] = XS[q];
                        top_count += 1;
                    }
                }
                if r1 != l1 {
                    TOP_CUTS[top_count] = r1;
                    top_count += 1;
                }
                let mut bi = 0usize;
                let mut ti = 0usize;
                while bi + 1 < bottom_count || ti + 1 < top_count {
                    let bp = if bi + 1 < bottom_count {
                        (BOTTOM_CUTS[bi + 1] - l0) / (r0 - l0)
                    } else {
                        1.7976931348623157e308
                    };
                    let tp = if ti + 1 < top_count {
                        (TOP_CUTS[ti + 1] - l1) / (r1 - l1)
                    } else {
                        1.7976931348623157e308
                    };
                    if bp <= tp {
                        add_triangle(
                            &mut tri_count,
                            BOTTOM_CUTS[bi],
                            y0,
                            depth,
                            BOTTOM_CUTS[bi + 1],
                            y0,
                            depth,
                            TOP_CUTS[ti],
                            y1,
                            depth,
                        );
                        add_triangle(
                            &mut tri_count,
                            BOTTOM_CUTS[bi],
                            y0,
                            0.0,
                            TOP_CUTS[ti],
                            y1,
                            0.0,
                            BOTTOM_CUTS[bi + 1],
                            y0,
                            0.0,
                        );
                        bi += 1;
                    } else {
                        add_triangle(
                            &mut tri_count,
                            BOTTOM_CUTS[bi],
                            y0,
                            depth,
                            TOP_CUTS[ti + 1],
                            y1,
                            depth,
                            TOP_CUTS[ti],
                            y1,
                            depth,
                        );
                        add_triangle(
                            &mut tri_count,
                            BOTTOM_CUTS[bi],
                            y0,
                            0.0,
                            TOP_CUTS[ti],
                            y1,
                            0.0,
                            TOP_CUTS[ti + 1],
                            y1,
                            0.0,
                        );
                        ti += 1;
                    }
                }
                i += 2;
            }
        }
        band += 1;
    }
    for l in 0..loop_count as usize {
        for i in 0..LOOP_LENGTHS[l] as usize {
            let side = Segment {
                a: LOOPS[l][i],
                b: LOOPS[l][(i + 1) % LOOP_LENGTHS[l] as usize],
            };
            let a = side.a;
            let b = side.b;
            if a.y == b.y {
                let mut have = 0u32;
                let mut prior = 0.0f64;
                if a.x < b.x {
                    for q in 0..unique_x {
                        if XS[q] >= a.x && XS[q] <= b.x {
                            if have != 0 {
                                add_triangle(&mut tri_count, prior, a.y, 0.0, XS[q], a.y, 0.0, XS[q], a.y, depth);
                                add_triangle(&mut tri_count, prior, a.y, 0.0, XS[q], a.y, depth, prior, a.y, depth);
                            }
                            prior = XS[q];
                            have = 1;
                        }
                    }
                } else {
                    let mut q = unique_x;
                    while q > 0 {
                        let qi = q - 1;
                        if XS[qi] <= a.x && XS[qi] >= b.x {
                            if have != 0 {
                                add_triangle(&mut tri_count, prior, a.y, 0.0, XS[qi], a.y, 0.0, XS[qi], a.y, depth);
                                add_triangle(&mut tri_count, prior, a.y, 0.0, XS[qi], a.y, depth, prior, a.y, depth);
                            }
                            prior = XS[qi];
                            have = 1;
                        }
                        q -= 1;
                    }
                }
            } else if a.y < b.y {
                let mut have = 0u32;
                let mut prior = 0.0f64;
                for q in 0..unique {
                    if YS[q] >= a.y && YS[q] <= b.y {
                        if have != 0 {
                            let y0 = prior;
                            let y1 = YS[q];
                            let x0 = x_at(&side, y0);
                            let x1 = x_at(&side, y1);
                            add_triangle(&mut tri_count, x0, y0, 0.0, x1, y1, 0.0, x1, y1, depth);
                            add_triangle(&mut tri_count, x0, y0, 0.0, x1, y1, depth, x0, y0, depth);
                        }
                        prior = YS[q];
                        have = 1;
                    }
                }
            } else {
                let mut have = 0u32;
                let mut prior = 0.0f64;
                let mut q = unique;
                while q > 0 {
                    let qi = q - 1;
                    if YS[qi] <= a.y && YS[qi] >= b.y {
                        if have != 0 {
                            let y0 = prior;
                            let y1 = YS[qi];
                            let x0 = x_at(&side, y0);
                            let x1 = x_at(&side, y1);
                            add_triangle(&mut tri_count, x0, y0, 0.0, x1, y1, 0.0, x1, y1, depth);
                            add_triangle(&mut tri_count, x0, y0, 0.0, x1, y1, depth, x0, y0, depth);
                        }
                        prior = YS[qi];
                        have = 1;
                    }
                    q -= 1;
                }
            }
        }
    }
    tri_count
}

#[no_mangle]
pub extern "C" fn run() -> u32 {
    unsafe {
        if read_u32(0) != INPUT_MAGIC
            || read_u32(4) != 1
            || read_u32(8) > 2
            || read_u32(12) != 8
            || read_u32(16) != 32
        {
            return 0;
        }
        let hole_count = read_u32(8);
        let w = read_f64(24);
        let h = read_f64(32);
        let depth = read_f64(40);
        let fillet = read_f64(48);
        let hole_r = read_f64(56);
        if finite_value(w) == 0
            || finite_value(h) == 0
            || finite_value(depth) == 0
            || finite_value(fillet) == 0
            || finite_value(hole_r) == 0
            || !(w > 0.0 && h > 0.0 && depth > 0.0 && fillet >= 0.0 && hole_r > 0.0
                && fillet * 2.0 < if w < h { w } else { h })
        {
            return 0;
        }
        for hole in 0..hole_count {
            let cx = read_f64(64 + hole * 16);
            let cy = read_f64(72 + hole * 16);
            if finite_value(cx) == 0 || finite_value(cy) == 0 {
                return 0;
            }
        }
        for a in 0..hole_count {
            for b in (a + 1)..hole_count {
                let dx = read_f64(64 + a * 16) - read_f64(64 + b * 16);
                let dy = read_f64(72 + a * 16) - read_f64(72 + b * 16);
                if dx * dx + dy * dy <= 4.0 * hole_r * hole_r {
                    return 0;
                }
            }
        }
        make_box_solid(&mut BREP, w, h, depth);
        let mut boolean_tests = 0u64;
        for hole in 0..hole_count {
            let cx = read_f64(64 + hole * 16);
            let cy = read_f64(72 + hole * 16);
            make_cylinder_solid(&mut CYLINDER_TOOL, cx, cy, hole_r, depth);
            if boolean_cut(&mut BREP, &CYLINDER_TOOL, w, h, fillet, &mut boolean_tests) == 0 {
                return 0;
            }
        }
        if fillet_vertical_edges(&mut BREP, w, h, depth, fillet) == 0 {
            return 0;
        }
        BREP.feature_nodes += 1;
        let mut topology = BrepTopology::default();
        if validate_brep(&BREP, &mut topology) == 0 || topology.genus != hole_count {
            return 0;
        }
        let loop_count = construct_face_loops_from_brep(&BREP, 1);
        if loop_count == 0 {
            return 0;
        }
        let mut bands = 0u64;
        let mut tests = 0u64;
        let mut comparisons = 0u64;
        let triangle_count = tessellate_faces(loop_count, depth, &mut bands, &mut tests, &mut comparisons);
        if triangle_count == 0 {
            return 0;
        }
        let mut loop_values = 0u32;
        for l in 0..loop_count as usize {
            loop_values += LOOP_LENGTHS[l] * 2;
        }
        let output_bytes = (HEADER_BYTES as u32) + loop_values * 8 + triangle_count * 72;
        if output_bytes as usize > OUTPUT_CAPACITY {
            return 0;
        }
        for i in 0..HEADER_BYTES {
            OUTPUT_DATA[i] = 0;
        }
        write_u32(0, OUTPUT_MAGIC);
        write_u32(4, 2);
        write_u32(8, LOOP_LENGTHS[0]);
        write_u32(12, hole_count);
        write_u32(16, 32);
        write_u32(20, triangle_count);
        write_u32(24, BREP.face_count);
        write_u32(28, BREP.edge_count);
        write_u32(32, BREP.vertex_count);
        write_u32(36, topology.genus);
        write_u32(40, BREP.coedge_count);
        write_u32(44, BREP.loop_count);
        write_i32(48, topology.euler_characteristic);
        write_u32(52, topology.connected_components);
        write_u32(56, topology.shells);
        write_u32(60, 0);
        let counters = [
            BREP.feature_nodes,
            BREP.box_solids,
            BREP.cylinder_solids,
            BREP.boolean_cuts,
            BREP.fillet_edges,
            boolean_tests,
            bands,
            tests,
            comparisons,
            triangle_count as u64,
            (triangle_count as u64) * 3,
            INPUT_BYTES as u64,
            output_bytes as u64,
        ];
        for i in 0..13 {
            write_u64(64 + i * 8, counters[i as usize]);
        }
        let mut off = HEADER_BYTES as u32;
        for l in 0..loop_count as usize {
            for i in 0..LOOP_LENGTHS[l] as usize {
                write_f64(off, LOOPS[l][i].x);
                off += 8;
                write_f64(off, LOOPS[l][i].y);
                off += 8;
            }
        }
        for i in 0..(triangle_count as usize) * 9 {
            write_f64(off, TRIANGLE_DATA[i]);
            off += 8;
        }
        output_bytes
    }
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}
