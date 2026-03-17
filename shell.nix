{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    (nodePackages.pnpm.override { nodejs = nodejs_22; })

    gcc
    gnumake
    python3

    sqlite
    ffmpeg
    git
    curl
    jq
  ];

  shellHook = ''
    echo "Tunarr dev environment"
    echo "  node: $(node --version)"
    echo "  pnpm: $(pnpm --version 2>/dev/null)"
    echo "  ffmpeg: $(ffmpeg -version 2>&1 | head -1)"
    echo ""
    echo "Common commands:"
    echo "  pnpm i               - Install dependencies"
    echo "  pnpm turbo dev       - Start backend (:8000) and frontend (:5173)"
    echo "  pnpm turbo build     - Build all packages"
    echo "  pnpm turbo test      - Run tests"
    echo "  pnpm turbo typecheck - Run typechecker"
  '';
}
