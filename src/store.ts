import { applyMiddleware, combineReducers, createStore } from "redux";
import keplerGlReducer, { enhanceReduxMiddleware } from "@kepler.gl/reducers";
export const store = createStore(
  combineReducers({
    keplerGl: keplerGlReducer.initialState({
      uiState: { currentModal: null, activeSidePanel: "autostacgis-settings" },
      mapStyle: { styleType: "osm" },
    }),
  }),
  applyMiddleware(...enhanceReduxMiddleware([])),
);
