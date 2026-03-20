{
  "targets": [
    {
      "target_name": "secure_ipc",
      "sources": [ "src/main/compression/daemon/native/secure_ipc.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15"
      },
      "conditions": [
        ['OS=="mac"', {
          "link_settings": {
            "libraries": [
              "-framework Foundation",
              "-framework Security"
            ]
          }
        }]
      ]
    }
  ]
}
