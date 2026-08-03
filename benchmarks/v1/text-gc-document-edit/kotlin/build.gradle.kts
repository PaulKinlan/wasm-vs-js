import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl

plugins {
  kotlin("multiplatform") version "2.3.21"
}

repositories { mavenCentral() }

dependencyLocking { lockAllConfigurations() }

@OptIn(ExperimentalWasmDsl::class)
kotlin {
  wasmJs {
    browser()
    binaries.executable()
  }
}
