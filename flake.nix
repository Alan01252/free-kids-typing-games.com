{
  description = "Kids Typing Games Hugo site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSystem = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forEachSystem (system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config = {
              allowUnfreePredicate = pkg:
                pkgs.lib.hasPrefix "android-" (pkgs.lib.getName pkg)
                || pkgs.lib.hasPrefix "platform" (pkgs.lib.getName pkg)
                || pkgs.lib.hasPrefix "build-tools" (pkgs.lib.getName pkg)
                || pkgs.lib.hasPrefix "extras-" (pkgs.lib.getName pkg)
                || pkgs.lib.hasPrefix "google-" (pkgs.lib.getName pkg)
                || pkgs.lib.hasPrefix "cmake" (pkgs.lib.getName pkg)
                || pkgs.lib.hasPrefix "cmdline-tools" (pkgs.lib.getName pkg)
                || pkgs.lib.elem (pkgs.lib.getName pkg) [
                  "androidsdk"
                  "platform-tools"
                  "tools"
                ];
              android_sdk.accept_license = true;
            };
          };
          android = pkgs.androidenv.composeAndroidPackages {
            platformVersions = [ "34" ];
            buildToolsVersions = [ "34.0.0" ];
            includeNDK = false;
            includeEmulator = false;
            includeSystemImages = false;
            includeSources = false;
            includeExtras = [
              "extras;android;m2repository"
              "extras;google;m2repository"
            ];
          };
        in {
          default = pkgs.mkShell {
            buildInputs = [
              pkgs.hugo
              pkgs.nodejs
              pkgs.jdk17
              android.androidsdk
              (pkgs.python313.withPackages (ps: with ps; [
                google-cloud-texttospeech
                google-genai
              ]))
              pkgs.google-cloud-sdk
            ];
            shellHook = ''
              export PATH=$PWD/node_modules/.bin:$PATH
              export ANDROID_HOME=${android.androidsdk}/libexec/android-sdk
              export ANDROID_SDK_ROOT=$ANDROID_HOME
              echo "Dev shell loaded with Hugo ${pkgs.hugo.version}."
            '';
          };
        }
      );
    };
}
