// Rust no_std mirror of the frozen cad-mesh-repair engine — bit-identical to
// engine.js repairMeshJavaScript and the C/C++ kernels. Same ABI:
// input_ptr()/output_ptr()/run(len).
#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

#[no_mangle]
pub static mut input_data: [u8; 120000] = [0; 120000];
#[no_mangle]
pub static mut output_data: [u8; 200000] = [0; 200000];
#[no_mangle]
pub static mut verts: [i32; 4096 * 3] = [0; 4096 * 3];
#[no_mangle]
pub static mut faces: [i32; 4096 * 3] = [0; 4096 * 3];
#[no_mangle]
pub static mut selected: [i32; 4096 * 3] = [0; 4096 * 3];
#[no_mangle]
pub static mut simpverts: [i32; 4096 * 3] = [0; 4096 * 3];
#[no_mangle]
pub static mut remap: [i32; 4096] = [0; 4096];
#[no_mangle]
pub static mut vcount: i32 = 0;
#[no_mangle]
pub static mut fcount: i32 = 0;
#[no_mangle]
pub static mut removed: i32 = 0;
#[no_mangle]
pub static mut flipped: i32 = 0;
#[no_mangle]
pub static mut vertex_weld_comparisons: i32 = 0;
#[no_mangle]
pub static mut unique_edges: i32 = 0;
#[no_mangle]
pub static mut simplification_weld_comparisons: i32 = 0;
#[no_mangle]
pub static mut clean_edge_comparisons: i32 = 0;
#[no_mangle]
pub static mut simplified_edge_comparisons: i32 = 0;

const MAXF: i32 = 4096;
const MAXV: i32 = 4096;
const HEADER_WORDS: i32 = 20;

fn read_u32(p: &[u8], at: usize) -> u32 {
    (p[at] as u32) | ((p[at + 1] as u32) << 8) | ((p[at + 2] as u32) << 16) | ((p[at + 3] as u32) << 24)
}

fn read_f32(p: &[u8], at: usize) -> f32 {
    f32::from_bits(read_u32(p, at))
}

fn quant(x: f32) -> i32 {
    if x.is_nan() || x > 100000.0 || x < -100000.0 {
        return 0x7fffffff;
    }
    let product = x * 10000.0;
    let adjusted = product + if product < 0.0 { -0.5 } else { 0.5 };
    adjusted as i32
}

fn write_i32(out: &mut [u8], at: usize, x: i32) {
    let v = x as u32;
    out[at] = v as u8;
    out[at + 1] = (v >> 8) as u8;
    out[at + 2] = (v >> 16) as u8;
    out[at + 3] = (v >> 24) as u8;
}

fn vertex(x: i32, y: i32, z: i32) -> i32 {
    unsafe {
        for i in 0..vcount as usize {
            vertex_weld_comparisons += 1;
            if verts[i * 3] == x && verts[i * 3 + 1] == y && verts[i * 3 + 2] == z {
                return i as i32;
            }
        }
        if vcount >= MAXV {
            return -1;
        }
        verts[vcount as usize * 3] = x;
        verts[vcount as usize * 3 + 1] = y;
        verts[vcount as usize * 3 + 2] = z;
        vcount += 1;
        vcount - 1
    }
}

fn same_edge(a: i32, b: i32, c: i32, d: i32) -> bool {
    (a == c && b == d) || (a == d && b == c)
}

#[no_mangle]
pub extern "C" fn input_ptr() -> i32 {
    unsafe { input_data.as_ptr() as i32 }
}

#[no_mangle]
pub extern "C" fn output_ptr() -> i32 {
    unsafe { output_data.as_ptr() as i32 }
}

#[no_mangle]
pub extern "C" fn run(len: i32) -> i32 {
    unsafe {
        if len < 84 {
            return -1;
        }
        let n = read_u32(&input_data, 80) as i32;
        if n < 1 || n > MAXF || len != 84 + n * 50 {
            return -2;
        }
        vcount = 0;
        fcount = 0;
        removed = 0;
        flipped = 0;
        vertex_weld_comparisons = 0;
        unique_edges = 0;
        simplification_weld_comparisons = 0;
        clean_edge_comparisons = 0;
        simplified_edge_comparisons = 0;

        let mut id = [0i32; 3];
        for f in 0..n {
            let at = (84 + f * 50 + 12) as usize;
            for p in 0..3 {
                let x = quant(read_f32(&input_data, at + p * 12));
                let y = quant(read_f32(&input_data, at + p * 12 + 4));
                let z = quant(read_f32(&input_data, at + p * 12 + 8));
                let vid = vertex(x, y, z);
                if vid < 0 {
                    return -3;
                }
                id[p as usize] = vid;
            }
            if id[0] == id[1] || id[1] == id[2] || id[0] == id[2] {
                removed += 1;
                continue;
            }
            let ax = verts[id[0] as usize * 3];
            let ay = verts[id[0] as usize * 3 + 1];
            let bx = verts[id[1] as usize * 3];
            let by = verts[id[1] as usize * 3 + 1];
            let cx = verts[id[2] as usize * 3];
            let cy = verts[id[2] as usize * 3 + 1];
            let nz = (bx as i64 - ax as i64) * (cy as i64 - ay as i64)
                - (by as i64 - ay as i64) * (cx as i64 - ax as i64);
            if nz == 0 {
                removed += 1;
                continue;
            }
            if nz < 0 {
                let sw = id[1];
                id[1] = id[2];
                id[2] = sw;
                flipped += 1;
            }
            if fcount >= MAXF {
                return -4;
            }
            faces[fcount as usize * 3] = id[0];
            faces[fcount as usize * 3 + 1] = id[1];
            faces[fcount as usize * 3 + 2] = id[2];
            fcount += 1;
        }
        let clean_face_count = fcount;
        if clean_face_count % 2 != 0 {
            return -5;
        }
        for i in 0..clean_face_count as usize {
            for e in 0..3usize {
                let a = faces[i * 3 + e];
                let b = faces[i * 3 + (e + 1) % 3];
                let mut incidence = 0;
                for j in 0..clean_face_count as usize {
                    for q in 0..3usize {
                        clean_edge_comparisons += 1;
                        if same_edge(a, b, faces[j * 3 + q], faces[j * 3 + (q + 1) % 3]) {
                            incidence += 1;
                        }
                    }
                }
                if incidence > 2 {
                    return -6;
                }
            }
        }
        let mut sv: i32 = 0;
        for i in 0..vcount as usize {
            let ox = verts[i * 3];
            let unit = ox / 10000;
            let x = if unit & 1 != 0 { ox - 10000 } else { ox };
            let y = verts[i * 3 + 1];
            let z = verts[i * 3 + 2];
            let mut next = -1;
            for c in 0..sv as usize {
                simplification_weld_comparisons += 1;
                if simpverts[c * 3] == x && simpverts[c * 3 + 1] == y && simpverts[c * 3 + 2] == z {
                    next = c as i32;
                    break;
                }
            }
            if next < 0 {
                next = sv;
                simpverts[sv as usize * 3] = x;
                simpverts[sv as usize * 3 + 1] = y;
                simpverts[sv as usize * 3 + 2] = z;
                sv += 1;
            }
            remap[i] = next;
        }
        let target = clean_face_count / 2;
        let mut sc: i32 = 0;
        for i in 0..clean_face_count as usize {
            let a = remap[faces[i * 3] as usize];
            let b = remap[faces[i * 3 + 1] as usize];
            let c = remap[faces[i * 3 + 2] as usize];
            if a != b && b != c && a != c {
                selected[sc as usize * 3] = a;
                selected[sc as usize * 3 + 1] = b;
                selected[sc as usize * 3 + 2] = c;
                sc += 1;
            }
        }
        if sc != target {
            return -7;
        }
        for i in 0..sc as usize {
            for e in 0..3usize {
                let a = selected[i * 3 + e];
                let b = selected[i * 3 + (e + 1) % 3];
                let mut incidence = 0;
                let mut seen = false;
                for j in 0..sc as usize {
                    for q in 0..3usize {
                        simplified_edge_comparisons += 1;
                        if same_edge(a, b, selected[j * 3 + q], selected[j * 3 + (q + 1) % 3]) {
                            incidence += 1;
                            if j < i as usize || (j == i as usize && q < e) {
                                seen = true;
                            }
                        }
                    }
                }
                if incidence > 2 {
                    return -8;
                }
                if !seen {
                    unique_edges += 1;
                }
            }
        }
        let mut volume6: i64 = 0;
        for i in 0..sc as usize {
            let a = selected[i * 3] as usize;
            let b = selected[i * 3 + 1] as usize;
            let c = selected[i * 3 + 2] as usize;
            let ax = simpverts[a * 3] as i64;
            let ay = simpverts[a * 3 + 1] as i64;
            let az = simpverts[a * 3 + 2] as i64;
            let bx = simpverts[b * 3] as i64;
            let by = simpverts[b * 3 + 1] as i64;
            let bz = simpverts[b * 3 + 2] as i64;
            let cx = simpverts[c * 3] as i64;
            let cy = simpverts[c * 3 + 1] as i64;
            let cz = simpverts[c * 3 + 2] as i64;
            volume6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
        }
        if volume6 != 0 {
            return -9;
        }
        let header: [i32; 20] = [
            0x4d455348, 2, n, vcount, fcount, target, removed, flipped, n * 3, unique_edges, sc, sv,
            volume6 as i32, sc, vertex_weld_comparisons, simplification_weld_comparisons,
            clean_edge_comparisons, simplified_edge_comparisons, 0, HEADER_WORDS,
        ];
        for (i, h) in header.iter().enumerate() {
            write_i32(&mut output_data, i * 4, *h);
        }
        let mut off = (HEADER_WORDS as usize) * 4;
        for i in 0..(sv as usize * 3) {
            write_i32(&mut output_data, off, simpverts[i]);
            off += 4;
        }
        for i in 0..(sc as usize * 3) {
            write_i32(&mut output_data, off, selected[i]);
            off += 4;
        }
        off as i32
    }
}
