// bracket.dart — Dart/WasmGC mirror of the frozen cad-parametric-bracket engine
// (bracket_c.c), bit-identical output_data bytes + output length. Doubles are
// native f64 (IEEE — matches C double exactly); u32 arithmetic is masked to 32
// bits. ABI: bracket(inputBytes, outputBytes) -> output byte length.
import 'dart:js_interop';
import 'dart:typed_data';

const int INPUT_BYTES = 128;
const int OUTPUT_CAPACITY = 2097152;
const int INPUT_MAGIC = 0x31425243;
const int OUTPUT_MAGIC = 0x314f5242;
const int HEADER_BYTES = 256;
const int MAX_LOOPS = 3;
const int MAX_POINTS = 40;
const int MAX_SEGMENTS = 104;
const int MAX_TRIANGLES = 20000;
const int MAX_BREP_VERTICES = 24;
const int MAX_BREP_EDGES = 36;
const int MAX_BREP_FACES = 16;
const int MAX_BREP_LOOPS = 20;
const int MAX_BREP_COEDGES = 72;
const int MAX_FACE_LOOPS = 3;
const int MAX_LOOP_COEDGES = 8;

const int SURFACE_PLANE = 1;
const int SURFACE_CYLINDER = 2;
const int CURVE_LINE = 1;
const int CURVE_CIRCLE = 2;

int _u32(int v) => v & 0xffffffff;

class P2 {
  double x, y;
  P2(this.x, this.y);
}
class Segment {
  P2 a, b;
  Segment(this.a, this.b);
}
class Hit {
  Segment edge;
  double x;
  Hit(this.edge, this.x);
}
class BrepVertex {
  double x, y, z;
  BrepVertex(this.x, this.y, this.z);
}
class BrepEdge {
  int curve, v0, v1, start_index, steps, coedge_count;
  List<int> coedges;
  double cx, cy, radius;
  BrepEdge()
      : curve = 0,
        v0 = 0,
        v1 = 0,
        start_index = 0,
        steps = 0,
        coedge_count = 0,
        cx = 0.0,
        cy = 0.0,
        radius = 0.0,
        coedges = List.filled(2, 0);
}
class BrepFace {
  int surface, loop_count;
  List<int> loops;
  double cx, cy, radius;
  BrepFace()
      : surface = 0,
        loop_count = 0,
        cx = 0.0,
        cy = 0.0,
        radius = 0.0,
        loops = List.filled(MAX_FACE_LOOPS, 0);
}
class BrepLoop {
  int face, coedge_count;
  List<int> coedges;
  BrepLoop()
      : face = 0,
        coedge_count = 0,
        coedges = List.filled(MAX_LOOP_COEDGES, 0);
}
class BrepCoedge {
  int edge, face, loop, next, previous, orientation;
  BrepCoedge()
      : edge = 0, face = 0, loop = 0, next = 0, previous = 0, orientation = 0;
}
class BrepSolid {
  List<BrepVertex> vertices;
  List<BrepEdge> edges;
  List<BrepFace> faces;
  List<BrepLoop> brep_loops;
  List<BrepCoedge> coedges;
  int vertex_count, edge_count, face_count, loop_count, coedge_count, hole_count;
  int feature_nodes, box_solids, cylinder_solids, boolean_cuts, fillet_edges;
  BrepSolid()
      : vertices = List.generate(MAX_BREP_VERTICES, (_) => BrepVertex(0, 0, 0)),
        edges = List.generate(MAX_BREP_EDGES, (_) => BrepEdge()),
        faces = List.generate(MAX_BREP_FACES, (_) => BrepFace()),
        brep_loops = List.generate(MAX_BREP_LOOPS, (_) => BrepLoop()),
        coedges = List.generate(MAX_BREP_COEDGES, (_) => BrepCoedge()),
        vertex_count = 0,
        edge_count = 0,
        face_count = 0,
        loop_count = 0,
        coedge_count = 0,
        hole_count = 0,
        feature_nodes = 0,
        box_solids = 0,
        cylinder_solids = 0,
        boolean_cuts = 0,
        fillet_edges = 0;
}
class BrepTopology {
  int connected_components, shells, genus, euler_characteristic;
  BrepTopology()
      : connected_components = 0, shells = 0, genus = 0, euler_characteristic = 0;
}

final List<double> _ux = [
  1.0, 0.9807852804032304, 0.9238795325112867, 0.8314696123025452,
  0.7071067811865476, 0.5555702330196023, 0.38268343236508984, 0.19509032201612833,
  0.0, -0.19509032201612833, -0.38268343236508984, -0.5555702330196023,
  -0.7071067811865476, -0.8314696123025452, -0.9238795325112867, -0.9807852804032304,
  -1.0, -0.9807852804032304, -0.9238795325112867, -0.8314696123025452,
  -0.7071067811865476, -0.5555702330196023, -0.38268343236508984, -0.19509032201612833,
  0.0, 0.19509032201612833, 0.38268343236508984, 0.5555702330196023,
  0.7071067811865476, 0.8314696123025452, 0.9238795325112867, 0.9807852804032304,
];
final List<double> _uy = [
  0.0, 0.19509032201612825, 0.3826834323650898, 0.5555702330196022,
  0.7071067811865475, 0.8314696123025452, 0.9238795325112867, 0.9807852804032304,
  1.0, 0.9807852804032304, 0.9238795325112867, 0.8314696123025452,
  0.7071067811865475, 0.5555702330196022, 0.3826834323650898, 0.19509032201612825,
  0.0, -0.19509032201612825, -0.3826834323650898, -0.5555702330196022,
  -0.7071067811865475, -0.8314696123025452, -0.9238795325112867, -0.9807852804032304,
  -1.0, -0.9807852804032304, -0.9238795325112867, -0.8314696123025452,
  -0.7071067811865475, -0.5555702330196022, -0.3826834323650898, -0.19509032201612825,
];

final List<List<P2>> _loops = List.generate(MAX_LOOPS, (_) => List.generate(MAX_POINTS, (_) => P2(0, 0)));
final List<int> _loop_lengths = List.filled(MAX_LOOPS, 0);
final List<Segment> _edge_data = List.generate(MAX_SEGMENTS, (_) => Segment(P2(0, 0), P2(0, 0)));
final List<double> _triangle_data = List.filled(MAX_TRIANGLES * 9, 0.0);
final List<double> _ys = List.filled(MAX_SEGMENTS, 0.0);
final List<double> _xs = List.filled(MAX_SEGMENTS, 0.0);
final List<double> _bottom_cuts = List.filled(MAX_SEGMENTS + 2, 0.0);
final List<double> _top_cuts = List.filled(MAX_SEGMENTS + 2, 0.0);
final List<Hit> _hits = List.generate(MAX_SEGMENTS, (_) => Hit(Segment(P2(0, 0), P2(0, 0)), 0.0));
final BrepSolid _brep = BrepSolid();
final BrepSolid _cylinder_tool = BrepSolid();

class _Ctx {
  final Uint8List input;
  final Uint8List output;
  final ByteData iv;
  final ByteData ov;
  _Ctx(this.input, this.output)
      : iv = ByteData.sublistView(input),
        ov = ByteData.sublistView(output);
}

int _readU32(_Ctx c, int off) => _u32(c.iv.getUint32(off, Endian.little));
double _readF64(_Ctx c, int off) => c.iv.getFloat64(off, Endian.little);
void _writeU32(_Ctx c, int off, int value) => c.ov.setUint32(off, _u32(value), Endian.little);
void _writeI32(_Ctx c, int off, int value) => c.ov.setInt32(off, value, Endian.little);
void _writeU64(_Ctx c, int off, int value) {
  c.ov.setUint32(off, _u32(value), Endian.little);
  c.ov.setUint32(off + 4, _u32(value >> 32), Endian.little);
}
void _writeF64(_Ctx c, int off, double value) => c.ov.setFloat64(off, value, Endian.little);

void _point(int loop, int cursor, double x, double y) {
  _loops[loop][cursor].x = x;
  _loops[loop][cursor].y = y;
}

void _initSolid(BrepSolid solid) {
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
  for (int i = 0; i < MAX_BREP_EDGES; i++) {
    solid.edges[i].coedge_count = 0;
  }
  for (int i = 0; i < MAX_BREP_FACES; i++) {
    solid.faces[i].loop_count = 0;
  }
}

int _addVertex(BrepSolid solid, double x, double y, double z) {
  final id = solid.vertex_count++;
  solid.vertices[id].x = x;
  solid.vertices[id].y = y;
  solid.vertices[id].z = z;
  return id;
}

int _addFace(BrepSolid solid, int surface, double cx, double cy, double radius) {
  final id = solid.face_count++;
  solid.faces[id].surface = surface;
  solid.faces[id].cx = cx;
  solid.faces[id].cy = cy;
  solid.faces[id].radius = radius;
  solid.faces[id].loop_count = 0;
  return id;
}

void _configureEdge(BrepSolid solid, int id, int curve, int v0, int v1, double cx, double cy, double radius, int start, int steps) {
  final edge = solid.edges[id];
  edge.curve = curve;
  edge.v0 = v0;
  edge.v1 = v1;
  edge.cx = cx;
  edge.cy = cy;
  edge.radius = radius;
  edge.start_index = start;
  edge.steps = steps;
  edge.coedge_count = 0;
}

int _addEdge(BrepSolid solid, int curve, int v0, int v1, double cx, double cy, double radius, int start, int steps) {
  final id = solid.edge_count++;
  _configureEdge(solid, id, curve, v0, v1, cx, cy, radius, start, steps);
  return id;
}

int _addLoop(BrepSolid solid, int face, List<int> edge_ids, List<int> orientations, int count) {
  final loop_id = solid.loop_count++;
  final loop = solid.brep_loops[loop_id];
  loop.face = face;
  loop.coedge_count = count;
  solid.faces[face].loops[solid.faces[face].loop_count++] = loop_id;
  for (int i = 0; i < count; i++) {
    final coedge_id = solid.coedge_count++;
    final coedge = solid.coedges[coedge_id];
    coedge.edge = edge_ids[i];
    coedge.face = face;
    coedge.loop = loop_id;
    coedge.orientation = orientations[i];
    loop.coedges[i] = coedge_id;
    final edge = solid.edges[edge_ids[i]];
    edge.coedges[edge.coedge_count++] = coedge_id;
  }
  for (int i = 0; i < count; i++) {
    final coedge = solid.coedges[loop.coedges[i]];
    coedge.previous = loop.coedges[(i + count - 1) % count];
    coedge.next = loop.coedges[(i + 1) % count];
  }
  return loop_id;
}

void _resetIncidence(BrepSolid solid) {
  solid.loop_count = 0;
  solid.coedge_count = 0;
  for (int i = 0; i < solid.edge_count; i++) {
    solid.edges[i].coedge_count = 0;
  }
  for (int i = 0; i < solid.face_count; i++) {
    solid.faces[i].loop_count = 0;
  }
}

void _makeBoxSolid(BrepSolid solid, double w, double h, double depth) {
  _initSolid(solid);
  final px = [0.0, w, w, 0.0];
  final py = [0.0, 0.0, h, h];
  for (int z = 0; z < 2; z++) {
    for (int i = 0; i < 4; i++) {
      _addVertex(solid, px[i], py[i], z != 0 ? depth : 0.0);
    }
  }
  final bottom = _addFace(solid, SURFACE_PLANE, 0.0, 0.0, 0.0);
  final top = _addFace(solid, SURFACE_PLANE, 0.0, 0.0, 0.0);
  final sides = List<int>.filled(4, 0);
  for (int i = 0; i < 4; i++) {
    sides[i] = _addFace(solid, SURFACE_PLANE, 0.0, 0.0, 0.0);
  }
  final bottom_edges = List<int>.filled(4, 0);
  final top_edges = List<int>.filled(4, 0);
  final vertical = List<int>.filled(4, 0);
  for (int i = 0; i < 4; i++) {
    bottom_edges[i] = _addEdge(solid, CURVE_LINE, i, (i + 1) % 4, 0.0, 0.0, 0.0, 0, 0);
    top_edges[i] = _addEdge(solid, CURVE_LINE, 4 + i, 4 + (i + 1) % 4, 0.0, 0.0, 0.0, 0, 0);
    vertical[i] = _addEdge(solid, CURVE_LINE, i, 4 + i, 0.0, 0.0, 0.0, 0, 0);
  }
  final bottom_loop = [bottom_edges[3], bottom_edges[2], bottom_edges[1], bottom_edges[0]];
  final negative = [-1, -1, -1, -1];
  final positive = [1, 1, 1, 1];
  _addLoop(solid, bottom, bottom_loop, negative, 4);
  _addLoop(solid, top, top_edges, positive, 4);
  for (int i = 0; i < 4; i++) {
    final side_loop = [bottom_edges[i], vertical[(i + 1) % 4], top_edges[i], vertical[i]];
    final side_orientation = [1, 1, -1, -1];
    _addLoop(solid, sides[i], side_loop, side_orientation, 4);
  }
  solid.feature_nodes++;
  solid.box_solids++;
}

void _makeCylinderSolid(BrepSolid tool, double cx, double cy, double radius, double depth) {
  _initSolid(tool);
  final v0 = _addVertex(tool, cx + radius, cy, 0.0);
  final v1 = _addVertex(tool, cx + radius, cy, depth);
  final bottom = _addFace(tool, SURFACE_PLANE, 0.0, 0.0, 0.0);
  final top = _addFace(tool, SURFACE_PLANE, 0.0, 0.0, 0.0);
  final wall = _addFace(tool, SURFACE_CYLINDER, cx, cy, radius);
  final rim0 = _addEdge(tool, CURVE_CIRCLE, v0, v0, cx, cy, radius, 0, 32);
  final rim1 = _addEdge(tool, CURVE_CIRCLE, v1, v1, cx, cy, radius, 0, 32);
  final seam = _addEdge(tool, CURVE_LINE, v0, v1, 0.0, 0.0, 0.0, 0, 0);
  final one = List<int>.filled(1, 0);
  final orientation = List<int>.filled(1, 0);
  one[0] = rim0;
  orientation[0] = -1;
  _addLoop(tool, bottom, one, orientation, 1);
  one[0] = rim1;
  orientation[0] = 1;
  _addLoop(tool, top, one, orientation, 1);
  final wall_edges = [rim0, seam, rim1, seam];
  final wall_orientation = [1, 1, -1, -1];
  _addLoop(tool, wall, wall_edges, wall_orientation, 4);
  tool.feature_nodes++;
  tool.cylinder_solids++;
}

int _validateBrep(BrepSolid solid, BrepTopology topology) {
  if (solid.face_count == 0) return 0;
  for (int edge = 0; edge < solid.edge_count; edge++) {
    final item = solid.edges[edge];
    if (item.v0 >= solid.vertex_count || item.v1 >= solid.vertex_count || item.coedge_count != 2) return 0;
    final a = solid.coedges[item.coedges[0]];
    final b = solid.coedges[item.coedges[1]];
    if (a.edge != edge || b.edge != edge || a.orientation + b.orientation != 0) return 0;
  }
  for (int face = 0; face < solid.face_count; face++) {
    final item = solid.faces[face];
    if (item.loop_count == 0) return 0;
    for (int li = 0; li < item.loop_count; li++) {
      final loop_id = item.loops[li];
      if (loop_id >= solid.loop_count) return 0;
      final loop = solid.brep_loops[loop_id];
      if (loop.face != face || loop.coedge_count == 0) return 0;
      for (int i = 0; i < loop.coedge_count; i++) {
        final id = loop.coedges[i];
        if (id >= solid.coedge_count) return 0;
        final coedge = solid.coedges[id];
        if (coedge.face != face || coedge.loop != loop_id ||
            coedge.previous != loop.coedges[(i + loop.coedge_count - 1) % loop.coedge_count] ||
            coedge.next != loop.coedges[(i + 1) % loop.coedge_count]) return 0;
      }
    }
  }
  final visited = List<int>.filled(MAX_BREP_FACES, 0);
  var components = 0;
  for (int start = 0; start < solid.face_count; start++) {
    if (visited[start] != 0) continue;
    final queue = List<int>.filled(MAX_BREP_FACES, 0);
    var head = 0, tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    components++;
    while (head < tail) {
      final face = queue[head++];
      for (int edge = 0; edge < solid.edge_count; edge++) {
        final item = solid.edges[edge];
        final a = solid.coedges[item.coedges[0]].face;
        final b = solid.coedges[item.coedges[1]].face;
        final next = a == face ? b : (b == face ? a : MAX_BREP_FACES);
        if (next < solid.face_count && visited[next] == 0) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
  }
  final euler = solid.vertex_count - solid.edge_count + solid.face_count - (solid.loop_count - solid.face_count);
  final twice_genus = 2 * components - euler;
  if (twice_genus < 0 || (twice_genus & 1) != 0) return 0;
  topology.connected_components = components;
  topology.shells = components;
  topology.euler_characteristic = euler;
  topology.genus = twice_genus ~/ 2;
  return 1;
}

int _booleanCut(BrepSolid solid, BrepSolid tool, double w, double h, double fillet, int booleanTestsRef) {
  final tool_topology = BrepTopology();
  if (_validateBrep(tool, tool_topology) == 0 || tool_topology.genus != 0) return 0;
  final cylinder = tool.faces[2];
  final cx = cylinder.cx, cy = cylinder.cy, radius = cylinder.radius;
  var booleanTests = booleanTestsRef;
  for (int k = 0; k < 32; k++) {
    final x = cx + radius * _ux[k];
    final y = cy + radius * _uy[k];
    final qx = x < fillet ? fillet - x : (x > w - fillet ? x - (w - fillet) : 0.0);
    final qy = y < fillet ? fillet - y : (y > h - fillet ? y - (h - fillet) : 0.0);
    booleanTests++;
    if (x < 0.0 || x > w || y < 0.0 || y > h || qx * qx + qy * qy > fillet * fillet + 1e-15) {
      _lastBooleanTests = booleanTests;
      return 0;
    }
  }
  final v0 = _addVertex(solid, tool.vertices[0].x, tool.vertices[0].y, tool.vertices[0].z);
  final v1 = _addVertex(solid, tool.vertices[1].x, tool.vertices[1].y, tool.vertices[1].z);
  final wall = _addFace(solid, SURFACE_CYLINDER, cx, cy, radius);
  final rim0 = _addEdge(solid, CURVE_CIRCLE, v0, v0, cx, cy, radius, 0, 32);
  final rim1 = _addEdge(solid, CURVE_CIRCLE, v1, v1, cx, cy, radius, 0, 32);
  final seam = _addEdge(solid, CURVE_LINE, v0, v1, 0.0, 0.0, 0.0, 0, 0);
  final one = List<int>.filled(1, 0);
  final orientation = List<int>.filled(1, 0);
  one[0] = rim0;
  orientation[0] = 1;
  _addLoop(solid, 0, one, orientation, 1);
  one[0] = rim1;
  orientation[0] = -1;
  _addLoop(solid, 1, one, orientation, 1);
  final wall_edges = [rim0, seam, rim1, seam];
  final wall_orientation = [-1, 1, 1, -1];
  _addLoop(solid, wall, wall_edges, wall_orientation, 4);
  solid.hole_count++;
  solid.feature_nodes += 2;
  solid.cylinder_solids++;
  solid.boolean_cuts++;
  _lastBooleanTests = booleanTests;
  final topology = BrepTopology();
  return _validateBrep(solid, topology);
}

P2 _profilePoint(int i, double w, double h, double r) {
  final px = [r, w - r, w, w, w - r, r, 0.0, 0.0];
  final py = [0.0, 0.0, r, h - r, h, h, h - r, r];
  return P2(px[i], py[i]);
}

void _profileCurve(int i, double w, double h, double r, List<double> out) {
  out[0] = 0.0; // cx
  out[1] = 0.0; // cy
  out[2] = 0.0; // start
  if (i == 1) { out[0] = w - r; out[1] = r; out[2] = 24; }
  else if (i == 3) { out[0] = w - r; out[1] = h - r; out[2] = 0; }
  else if (i == 5) { out[0] = r; out[1] = h - r; out[2] = 8; }
  else if (i == 7) { out[0] = r; out[1] = r; out[2] = 16; }
}

int _filletVerticalEdges(BrepSolid solid, double w, double h, double depth, double radius) {
  if (radius == 0.0) return 1;
  final holes = solid.hole_count;
  final bottom_vertices = List<int>.filled(8, 0);
  final top_vertices = List<int>.filled(8, 4);
  for (int i = 1; i < 8; i++) {
    final p = _profilePoint(i, w, h, radius);
    if ((i & 1) == 0) {
      bottom_vertices[i] = i ~/ 2;
      top_vertices[i] = 4 + i ~/ 2;
    } else {
      bottom_vertices[i] = _addVertex(solid, p.x, p.y, 0.0);
      top_vertices[i] = _addVertex(solid, p.x, p.y, depth);
    }
  }
  for (int i = 0; i < 8; i += 2) {
    final p = _profilePoint(i, w, h, radius);
    solid.vertices[bottom_vertices[i]].x = p.x;
    solid.vertices[bottom_vertices[i]].y = p.y;
    solid.vertices[bottom_vertices[i]].z = 0.0;
    solid.vertices[top_vertices[i]].x = p.x;
    solid.vertices[top_vertices[i]].y = p.y;
    solid.vertices[top_vertices[i]].z = depth;
  }
  final bottom_edges = List<int>.filled(8, 0);
  final top_edges = List<int>.filled(8, 0);
  final vertical = List<int>.filled(8, 0);
  final sides = List<int>.filled(8, 0);
  final curve = List<int>.filled(8, 0);
  for (int i = 0; i < 8; i++) {
    final next = (i + 1) % 8;
    final out = [0.0, 0.0, 0.0];
    _profileCurve(i, w, h, radius, out);
    final cx = out[0], cy = out[1], start = out[2].toInt();
    curve[i] = (i & 1) != 0 ? CURVE_CIRCLE : CURVE_LINE;
    if ((i & 1) == 0) {
      bottom_edges[i] = i ~/ 2;
      top_edges[i] = 4 + i ~/ 2;
      vertical[i] = 8 + i ~/ 2;
      sides[i] = 2 + i ~/ 2;
      _configureEdge(solid, bottom_edges[i], curve[i], bottom_vertices[i], bottom_vertices[next], cx, cy, radius, start, curve[i] == CURVE_CIRCLE ? 8 : 0);
      _configureEdge(solid, top_edges[i], curve[i], top_vertices[i], top_vertices[next], cx, cy, radius, start, curve[i] == CURVE_CIRCLE ? 8 : 0);
      _configureEdge(solid, vertical[i], CURVE_LINE, bottom_vertices[i], top_vertices[i], 0.0, 0.0, 0.0, 0, 0);
      solid.faces[sides[i]].surface = SURFACE_PLANE;
    } else {
      bottom_edges[i] = _addEdge(solid, curve[i], bottom_vertices[i], bottom_vertices[next], cx, cy, radius, start, 8);
      top_edges[i] = _addEdge(solid, curve[i], top_vertices[i], top_vertices[next], cx, cy, radius, start, 8);
      vertical[i] = _addEdge(solid, CURVE_LINE, bottom_vertices[i], top_vertices[i], 0.0, 0.0, 0.0, 0, 0);
      sides[i] = _addFace(solid, SURFACE_CYLINDER, cx, cy, radius);
      solid.feature_nodes++;
      solid.fillet_edges++;
    }
  }
  if (solid.vertex_count != 16 + 2 * holes || solid.edge_count != 24 + 3 * holes || solid.face_count != 10 + holes) return 0;
  _resetIncidence(solid);
  final reverse_bottom = List<int>.filled(8, 0);
  final negative = List<int>.filled(8, -1);
  final positive = List<int>.filled(8, 1);
  for (int i = 0; i < 8; i++) {
    reverse_bottom[i] = bottom_edges[7 - i];
  }
  _addLoop(solid, 0, reverse_bottom, negative, 8);
  _addLoop(solid, 1, top_edges, positive, 8);
  for (int i = 0; i < 8; i++) {
    final side_loop = [bottom_edges[i], vertical[(i + 1) % 8], top_edges[i], vertical[i]];
    final orientation = [1, 1, -1, -1];
    _addLoop(solid, sides[i], side_loop, orientation, 4);
  }
  for (int hole = 0; hole < holes; hole++) {
    final wall = 6 + hole;
    final edge = 12 + hole * 3;
    final one = List<int>.filled(1, 0);
    final orientation = List<int>.filled(1, 0);
    one[0] = edge;
    orientation[0] = 1;
    _addLoop(solid, 0, one, orientation, 1);
    one[0] = edge + 1;
    orientation[0] = -1;
    _addLoop(solid, 1, one, orientation, 1);
    final wall_edges = [edge, edge + 2, edge + 1, edge + 2];
    final wall_orientation = [-1, 1, 1, -1];
    _addLoop(solid, wall, wall_edges, wall_orientation, 4);
  }
  final topology = BrepTopology();
  return _validateBrep(solid, topology);
}

int _constructFaceLoopsFromBrep(BrepSolid solid, int face) {
  final plane = solid.faces[face];
  if (plane.loop_count > MAX_LOOPS) return 0;
  for (int li = 0; li < plane.loop_count; li++) {
    final loop = solid.brep_loops[plane.loops[li]];
    var cursor = 0;
    for (int ci = 0; ci < loop.coedge_count; ci++) {
      final coedge = solid.coedges[loop.coedges[ci]];
      final edge = solid.edges[coedge.edge];
      if (edge.curve == CURVE_LINE) {
        final vertex = coedge.orientation > 0 ? edge.v0 : edge.v1;
        _point(li, cursor, solid.vertices[vertex].x, solid.vertices[vertex].y);
        cursor++;
      } else if (coedge.orientation > 0) {
        for (int step = 0; step < edge.steps; step++) {
          final q = (edge.start_index + step) & 31;
          _point(li, cursor, edge.cx + edge.radius * _ux[q], edge.cy + edge.radius * _uy[q]);
          cursor++;
        }
      } else {
        for (int step = edge.steps; step > 0; step--) {
          final q = (edge.start_index + step) & 31;
          _point(li, cursor, edge.cx + edge.radius * _ux[q], edge.cy + edge.radius * _uy[q]);
          cursor++;
        }
      }
    }
    _loop_lengths[li] = cursor;
  }
  return plane.loop_count;
}

double _xAt(Segment s, double y) {
  if (s.a.y == s.b.y) return s.a.x < s.b.x ? s.a.x : s.b.x;
  return s.a.x + (s.b.x - s.a.x) * ((y - s.a.y) / (s.b.y - s.a.y));
}

void _addTriangle(List<int> state, double ax, double ay, double az, double bx, double by, double bz, double cx, double cy, double cz) {
  final abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  final nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
  final count = state[0];
  if (nx * nx + ny * ny + nz * nz <= 1e-30 || count >= MAX_TRIANGLES) return;
  final o = count * 9;
  _triangle_data[o] = ax; _triangle_data[o + 1] = ay; _triangle_data[o + 2] = az;
  _triangle_data[o + 3] = bx; _triangle_data[o + 4] = by; _triangle_data[o + 5] = bz;
  _triangle_data[o + 6] = cx; _triangle_data[o + 7] = cy; _triangle_data[o + 8] = cz;
  state[0] = count + 1;
}

int _tessellateFaces(int loop_count, double depth, List<int> bands, List<int> tests, List<int> comparisons) {
  var edge_count = 0, y_count = 0, x_count = 0;
  for (int l = 0; l < loop_count; l++) {
    for (int i = 0; i < _loop_lengths[l]; i++) {
      final s = _edge_data[edge_count++];
      s.a = _loops[l][i];
      s.b = _loops[l][(i + 1) % _loop_lengths[l]];
      _ys[y_count++] = _loops[l][i].y;
      _xs[x_count++] = _loops[l][i].x;
    }
  }
  for (int i = 1; i < y_count; i++) {
    final value = _ys[i];
    var j = i;
    while (j > 0 && _ys[j - 1] > value) { _ys[j] = _ys[j - 1]; j--; }
    _ys[j] = value;
  }
  var unique = 0;
  for (int i = 0; i < y_count; i++) {
    if (i == 0 || _ys[i] != _ys[i - 1]) _ys[unique++] = _ys[i];
  }
  for (int i = 1; i < x_count; i++) {
    final value = _xs[i];
    var j = i;
    while (j > 0 && _xs[j - 1] > value) { _xs[j] = _xs[j - 1]; j--; }
    _xs[j] = value;
  }
  var unique_x = 0;
  for (int i = 0; i < x_count; i++) {
    if (i == 0 || _xs[i] != _xs[i - 1]) _xs[unique_x++] = _xs[i];
  }
  final triState = [0];
  for (int band = 0; band + 1 < unique; band++) {
    final y0 = _ys[band], y1 = _ys[band + 1];
    if (!(y1 > y0)) continue;
    final mid = (y0 + y1) * 0.5;
    var hit_count = 0;
    for (int e = 0; e < edge_count; e++) {
      tests[0]++;
      final s = _edge_data[e];
      final ay = s.a.y, by = s.b.y;
      if ((ay <= mid && mid < by) || (by <= mid && mid < ay)) {
        final value = _xAt(s, mid);
        var j = hit_count++;
        _hits[j] = Hit(s, value);
        while (j > 0) {
          comparisons[0]++;
          if (_hits[j - 1].x <= value) break;
          _hits[j] = _hits[j - 1];
          j--;
        }
        _hits[j] = Hit(s, value);
      }
    }
    if ((hit_count & 1) != 0) return 0;
    bands[0]++;
    for (int i = 0; i < hit_count; i += 2) {
      final l = _hits[i].edge, r = _hits[i + 1].edge;
      final l0 = _xAt(l, y0), l1 = _xAt(l, y1), r0 = _xAt(r, y0), r1 = _xAt(r, y1);
      var bottom_count = 0, top_count = 0;
      _bottom_cuts[bottom_count++] = l0;
      for (int q = 0; q < unique_x; q++) {
        if (_xs[q] > l0 && _xs[q] < r0) _bottom_cuts[bottom_count++] = _xs[q];
      }
      if (r0 != l0) _bottom_cuts[bottom_count++] = r0;
      _top_cuts[top_count++] = l1;
      for (int q = 0; q < unique_x; q++) {
        if (_xs[q] > l1 && _xs[q] < r1) _top_cuts[top_count++] = _xs[q];
      }
      if (r1 != l1) _top_cuts[top_count++] = r1;
      var bi = 0, ti = 0;
      while (bi + 1 < bottom_count || ti + 1 < top_count) {
        final bp = bi + 1 < bottom_count ? (_bottom_cuts[bi + 1] - l0) / (r0 - l0) : 1.7976931348623157e308;
        final tp = ti + 1 < top_count ? (_top_cuts[ti + 1] - l1) / (r1 - l1) : 1.7976931348623157e308;
        if (bp <= tp) {
          _addTriangle(triState, _bottom_cuts[bi], y0, depth, _bottom_cuts[bi + 1], y0, depth, _top_cuts[ti], y1, depth);
          _addTriangle(triState, _bottom_cuts[bi], y0, 0.0, _top_cuts[ti], y1, 0.0, _bottom_cuts[bi + 1], y0, 0.0);
          bi++;
        } else {
          _addTriangle(triState, _bottom_cuts[bi], y0, depth, _top_cuts[ti + 1], y1, depth, _top_cuts[ti], y1, depth);
          _addTriangle(triState, _bottom_cuts[bi], y0, 0.0, _top_cuts[ti], y1, 0.0, _top_cuts[ti + 1], y1, 0.0);
          ti++;
        }
      }
    }
  }
  for (int l = 0; l < loop_count; l++) {
    for (int i = 0; i < _loop_lengths[l]; i++) {
      final side = Segment(_loops[l][i], _loops[l][(i + 1) % _loop_lengths[l]]);
      final a = side.a, b = side.b;
      if (a.y == b.y) {
        var have = 0;
        double prior = 0.0;
        if (a.x < b.x) {
          for (int q = 0; q < unique_x; q++) {
            if (_xs[q] >= a.x && _xs[q] <= b.x) {
              if (have != 0) {
                _addTriangle(triState, prior, a.y, 0.0, _xs[q], a.y, 0.0, _xs[q], a.y, depth);
                _addTriangle(triState, prior, a.y, 0.0, _xs[q], a.y, depth, prior, a.y, depth);
              }
              prior = _xs[q];
              have = 1;
            }
          }
        } else {
          for (int q = unique_x; q > 0; q--) {
            final qi = q - 1;
            if (_xs[qi] <= a.x && _xs[qi] >= b.x) {
              if (have != 0) {
                _addTriangle(triState, prior, a.y, 0.0, _xs[qi], a.y, 0.0, _xs[qi], a.y, depth);
                _addTriangle(triState, prior, a.y, 0.0, _xs[qi], a.y, depth, prior, a.y, depth);
              }
              prior = _xs[qi];
              have = 1;
            }
          }
        }
      } else if (a.y < b.y) {
        var have = 0;
        double prior = 0.0;
        for (int q = 0; q < unique; q++) {
          if (_ys[q] >= a.y && _ys[q] <= b.y) {
            if (have != 0) {
              final y0 = prior, y1 = _ys[q], x0 = _xAt(side, y0), x1 = _xAt(side, y1);
              _addTriangle(triState, x0, y0, 0.0, x1, y1, 0.0, x1, y1, depth);
              _addTriangle(triState, x0, y0, 0.0, x1, y1, depth, x0, y0, depth);
            }
            prior = _ys[q];
            have = 1;
          }
        }
      } else {
        var have = 0;
        double prior = 0.0;
        for (int q = unique; q > 0; q--) {
          final qi = q - 1;
          if (_ys[qi] <= a.y && _ys[qi] >= b.y) {
            if (have != 0) {
              final y0 = prior, y1 = _ys[qi], x0 = _xAt(side, y0), x1 = _xAt(side, y1);
              _addTriangle(triState, x0, y0, 0.0, x1, y1, 0.0, x1, y1, depth);
              _addTriangle(triState, x0, y0, 0.0, x1, y1, depth, x0, y0, depth);
            }
            prior = _ys[qi];
            have = 1;
          }
        }
      }
    }
  }
  return triState[0];
}

@JSExport()
class BracketKernels {
  @JSExport('bracket')
  int bracket(JSUint8Array inputJs, JSUint8Array outputJs) {
    final input = inputJs.toDart; // Uint8List view
    final output = outputJs.toDart; // Uint8List view
    final c = _Ctx(input, output);
    if (_readU32(c, 0) != INPUT_MAGIC || _readU32(c, 4) != 1 || _readU32(c, 8) > 2 || _readU32(c, 12) != 8 || _readU32(c, 16) != 32) return 0;
    final hole_count = _readU32(c, 8);
    final w = _readF64(c, 24), h = _readF64(c, 32), depth = _readF64(c, 40), fillet = _readF64(c, 48), hole_r = _readF64(c, 56);
    if (w != w || h != h || depth != depth || fillet != fillet || hole_r != hole_r ||
        !(w > 0.0 && h > 0.0 && depth > 0.0 && fillet >= 0.0 && hole_r > 0.0 && fillet * 2.0 < (w < h ? w : h))) return 0;
    for (int hole = 0; hole < hole_count; hole++) {
      final cx = _readF64(c, 64 + hole * 16), cy = _readF64(c, 72 + hole * 16);
      if (cx != cx || cy != cy) return 0;
    }
    for (int a = 0; a < hole_count; a++) {
      for (int b = a + 1; b < hole_count; b++) {
        final dx = _readF64(c, 64 + a * 16) - _readF64(c, 64 + b * 16);
        final dy = _readF64(c, 72 + a * 16) - _readF64(c, 72 + b * 16);
        if (dx * dx + dy * dy <= 4.0 * hole_r * hole_r) return 0;
      }
    }
    _makeBoxSolid(_brep, w, h, depth);
    var boolean_tests = 0;
    for (int hole = 0; hole < hole_count; hole++) {
      final cx = _readF64(c, 64 + hole * 16), cy = _readF64(c, 72 + hole * 16);
      _makeCylinderSolid(_cylinder_tool, cx, cy, hole_r, depth);
      final ok = _booleanCut(_brep, _cylinder_tool, w, h, fillet, boolean_tests);
      boolean_tests = _lastBooleanTests;
      if (ok == 0) return 0;
    }
    if (_filletVerticalEdges(_brep, w, h, depth, fillet) == 0) return 0;
    _brep.feature_nodes++;
    final topology = BrepTopology();
    if (_validateBrep(_brep, topology) == 0 || topology.genus != hole_count) return 0;
    final loop_count = _constructFaceLoopsFromBrep(_brep, 1);
    if (loop_count == 0) return 0;
    final bands = [0], tests = [0], comparisons = [0];
    final triangle_count = _tessellateFaces(loop_count, depth, bands, tests, comparisons);
    if (triangle_count == 0) return 0;
    var loop_values = 0;
    for (int l = 0; l < loop_count; l++) {
      loop_values += _loop_lengths[l] * 2;
    }
    final output_bytes = HEADER_BYTES + loop_values * 8 + triangle_count * 72;
    if (output_bytes > OUTPUT_CAPACITY) return 0;
    for (int i = 0; i < HEADER_BYTES; i++) {
      output[i] = 0;
    }
    _writeU32(c, 0, OUTPUT_MAGIC);
    _writeU32(c, 4, 2);
    _writeU32(c, 8, _loop_lengths[0]);
    _writeU32(c, 12, hole_count);
    _writeU32(c, 16, 32);
    _writeU32(c, 20, triangle_count);
    _writeU32(c, 24, _brep.face_count);
    _writeU32(c, 28, _brep.edge_count);
    _writeU32(c, 32, _brep.vertex_count);
    _writeU32(c, 36, topology.genus);
    _writeU32(c, 40, _brep.coedge_count);
    _writeU32(c, 44, _brep.loop_count);
    _writeI32(c, 48, topology.euler_characteristic);
    _writeU32(c, 52, topology.connected_components);
    _writeU32(c, 56, topology.shells);
    _writeU32(c, 60, 0);
    final counters = [
      _brep.feature_nodes, _brep.box_solids, _brep.cylinder_solids, _brep.boolean_cuts,
      _brep.fillet_edges, boolean_tests, bands[0], tests[0], comparisons[0],
      triangle_count, triangle_count * 3, INPUT_BYTES, output_bytes,
    ];
    for (int i = 0; i < 13; i++) {
      _writeU64(c, 64 + i * 8, counters[i]);
    }
    var off = HEADER_BYTES;
    for (int l = 0; l < loop_count; l++) {
      for (int i = 0; i < _loop_lengths[l]; i++) {
        _writeF64(c, off, _loops[l][i].x);
        off += 8;
        _writeF64(c, off, _loops[l][i].y);
        off += 8;
      }
    }
    for (int i = 0; i < triangle_count * 9; i++) {
      _writeF64(c, off, _triangle_data[i]);
      off += 8;
    }
    return output_bytes;
  }
}

int _lastBooleanTests = 0;

void main() {
  dartKernels = createJSInteropWrapper(BracketKernels());
}

@JS('dartKernels')
external set dartKernels(JSObject value);
