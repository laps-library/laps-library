import { Dimensions, Image } from "react-native";

export const W = Dimensions.get("window").width;
export const H = Dimensions.get("window").height;

export const HOME_GIF = require("../assets/home.gif");
export const LOGO_GIF = require("../assets/logo-anim.gif");

const _hi = Image.resolveAssetSource(HOME_GIF);
const _li = Image.resolveAssetSource(LOGO_GIF);

// splash en contain pleine largeur
const SPLASH_H = W * (_li.height / _li.width);

// gif allongé de la home (borné à 95% de la largeur)
let hw = SPLASH_H * (_hi.width / _hi.height);
if (hw > W * 0.95) hw = W * 0.95;
export const HOME_W = hw;
export const HOME_H = hw / (_hi.width / _hi.height);

// logo du splash à 90% de la largeur
export const LOGO_W = W * 0.9;
export const LOGO_H = LOGO_W * (_li.height / _li.width);

// POSITION COMMUNE : haut des deux gifs aligné (modifie ICI si besoin)
export const GIF_TOP = H * 0.2;
