@file:OptIn(kotlin.js.ExperimentalJsExport::class)

private const val FORMAT = "text-gc-document-edit-fixture-v1"

private class DocumentNode(
    val id: Int,
    val label: String,
    var parent: DocumentNode?,
) {
    val children: MutableList<DocumentNode> = mutableListOf()
}

private fun decodeHex(value: String): String {
    require(value.length % 2 == 0 && value.all { it in '0'..'9' || it in 'a'..'f' }) {
        "invalid UTF-8 hex label"
    }
    val bytes = ByteArray(value.length / 2)
    for (index in bytes.indices) {
        bytes[index] = value.substring(index * 2, index * 2 + 2).toInt(16).toByte()
    }
    return bytes.decodeToString(throwOnInvalidSequence = true)
}

private fun escapeCanonical(value: String): String = buildString {
    for (character in value) {
        if (character == '\\' || character == '(' || character == ')' || character == '[' ||
            character == ']' || character == ':'
        ) append('\\')
        append(character)
    }
}

private fun jsonEscape(value: String): String = buildString {
    append('"')
    for (character in value) {
        when (character) {
            '"' -> append("\\\"")
            '\\' -> append("\\\\")
            '\b' -> append("\\b")
            '\u000c' -> append("\\f")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> if (character.code < 0x20) {
                append("\\u")
                append(character.code.toString(16).padStart(4, '0'))
            } else append(character)
        }
    }
    append('"')
}

private fun parseNonNegative(value: String, name: String): Int {
    val number = value.toIntOrNull() ?: error("$name must be an integer")
    require(number >= 0) { "$name must be non-negative" }
    return number
}

@JsExport
fun wasmGcFeatureProof(): String {
    val root = DocumentNode(0, "WasmGC", null)
    root.children.add(DocumentNode(1, "array-backed child", root))
    return "${root.id}:${root.children[0].label}:${root.children.size}"
}

@JsExport
fun runDocumentFixture(fixtureText: String): String {
    val lines = fixtureText.trimEnd().split('\n')
    var cursor = 0
    require(lines[cursor++] == FORMAT) { "fixture format mismatch" }
    val initialHeader = lines[cursor++].split('\t')
    val operationHeader = lines[cursor++].split('\t')
    require(initialHeader.size == 2 && initialHeader[0] == "initial") { "invalid initial header" }
    require(operationHeader.size == 2 && operationHeader[0] == "operations") {
        "invalid operations header"
    }
    val initialCount = parseNonNegative(initialHeader[1], "initial count")
    val operationCount = parseNonNegative(operationHeader[1], "operation count")
    require(operationCount == 10_000) { "fixture must contain exactly 10,000 edits" }

    val nodes = mutableMapOf<Int, DocumentNode>()
    var root: DocumentNode? = null
    var childInsertions = 0
    var childRemovals = 0
    var parentWrites = 0
    repeat(initialCount) { index ->
        val fields = lines[cursor++].split('\t')
        require(fields.size == 5 && fields[0] == "N") { "invalid node row $index" }
        val id = parseNonNegative(fields[1], "node id")
        val parentId = fields[2].toIntOrNull() ?: error("parent id must be an integer")
        val position = parseNonNegative(fields[3], "node position")
        require(!nodes.containsKey(id)) { "duplicate initial node $id" }
        val node = DocumentNode(id, decodeHex(fields[4]), null)
        nodes[id] = node
        if (parentId == -1) {
            require(root == null) { "multiple roots" }
            root = node
        } else {
            val parent = nodes[parentId] ?: error("initial parent $parentId must precede child")
            require(position <= parent.children.size) { "initial child position out of range" }
            parent.children.add(position, node)
            node.parent = parent
            childInsertions++
            parentWrites++
        }
    }
    val rootNode = root ?: error("root missing")
    require(rootNode.id == 0) { "root id must be 0" }

    var inserted = 0
    var deleted = 0
    var reparented = 0
    repeat(operationCount) { operationIndex ->
        require(cursor < lines.size) { "operation count mismatch" }
        val fields = lines[cursor++].split('\t')
        when (fields.firstOrNull()) {
            "I" -> {
                require(fields.size == 5) { "invalid insert row $operationIndex" }
                val id = parseNonNegative(fields[1], "insert id")
                val parentId = parseNonNegative(fields[2], "insert parent")
                val position = parseNonNegative(fields[3], "insert position")
                require(!nodes.containsKey(id)) { "insert id already exists: $id" }
                val parent = nodes[parentId] ?: error("insert parent missing: $parentId")
                require(position <= parent.children.size) { "insert position out of range" }
                val node = DocumentNode(id, decodeHex(fields[4]), parent)
                parent.children.add(position, node)
                nodes[id] = node
                inserted++
                childInsertions++
                parentWrites++
            }
            "D" -> {
                require(fields.size == 2) { "invalid delete row $operationIndex" }
                val id = parseNonNegative(fields[1], "delete id")
                val node = nodes[id] ?: error("delete target missing: $id")
                require(node !== rootNode) { "cannot delete root" }
                require(node.children.isEmpty()) { "delete target is not a leaf: $id" }
                val parent = node.parent ?: error("delete target has no parent")
                require(parent.children.remove(node)) { "delete parent link mismatch" }
                nodes.remove(id)
                node.parent = null
                deleted++
                childRemovals++
                parentWrites++
            }
            "R" -> {
                require(fields.size == 4) { "invalid reparent row $operationIndex" }
                val id = parseNonNegative(fields[1], "reparent id")
                val parentId = parseNonNegative(fields[2], "reparent parent")
                val position = parseNonNegative(fields[3], "reparent position")
                val node = nodes[id] ?: error("reparent target missing: $id")
                val parent = nodes[parentId] ?: error("reparent parent missing: $parentId")
                require(node !== rootNode) { "cannot reparent root" }
                var ancestor: DocumentNode? = parent
                while (ancestor != null) {
                    require(ancestor !== node) { "reparent would create a cycle" }
                    ancestor = ancestor.parent
                }
                val oldParent = node.parent ?: error("reparent target has no parent")
                require(oldParent.children.remove(node)) { "reparent old link mismatch" }
                require(position <= parent.children.size) { "reparent position out of range" }
                parent.children.add(position, node)
                node.parent = parent
                reparented++
                childRemovals++
                childInsertions++
                parentWrites++
            }
            else -> error("invalid operation row $operationIndex")
        }
    }
    require(cursor == lines.size) { "unexpected fixture rows" }

    val seen = mutableSetOf<Int>()
    val canonical = buildString {
        fun visit(node: DocumentNode) {
            require(seen.add(node.id)) { "cycle or duplicate traversal" }
            append('(')
            append(node.id)
            append(':')
            append(escapeCanonical(node.label))
            append('[')
            for (child in node.children) {
                require(child.parent === node) { "parent/child identity mismatch" }
                visit(child)
            }
            append("])" )
        }
        visit(rootNode)
    }
    require(seen.size == nodes.size) { "unreachable nodes remain" }

    return buildString {
        append('{')
        append("\"variant\":\"wasmgc-controlled\",")
        append("\"canonical\":")
        append(jsonEscape(canonical))
        append(",\"counters\":{")
        val counters = listOf(
            "initial-nodes" to initialCount,
            "operations" to operationCount,
            "inserts" to inserted,
            "deletes" to deleted,
            "reparents" to reparented,
            "final-nodes" to nodes.size,
            "child-insertions" to childInsertions,
            "child-removals" to childRemovals,
            "parent-writes" to parentWrites,
            "node-object-allocations" to initialCount + inserted,
            "child-list-allocations" to initialCount + inserted,
            "label-values" to initialCount + inserted,
            "traversal-nodes" to seen.size,
            "boundary-crossings" to 2,
        )
        counters.forEachIndexed { index, (name, value) ->
            if (index > 0) append(',')
            append(jsonEscape(name))
            append(':')
            append(value)
        }
        append("},\"identity\":{")
        append("\"rootId\":0,\"reachableNodes\":${seen.size},\"uniqueNodeIds\":${seen.size},")
        append("\"parentChildLinksValid\":true,\"orderedChildrenRetained\":true},")
        append("\"gcDiagnostics\":{")
        append("\"status\":\"unavailable\",")
        append("\"reason\":\"Portable GC events and runtime-internal allocation counts are not exposed by the Web platform.\"}")
        append('}')
    }
}

fun main() {}
