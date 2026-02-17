{ pkgs, ... }:

{
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_20
  ];

  idx = {
    previews = {
      enable = true;
      previews = {
        web = {
          manager = "web";
          command = [
            "npm"
            "run"
            "dev"
          ];
        };
      };
    };
  };
}
