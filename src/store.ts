import { applyMiddleware, combineReducers, createStore } from "redux";
import keplerGlReducer, { enhanceReduxMiddleware } from "@kepler.gl/reducers";
export const store = createStore(
  combineReducers({
    keplerGl: keplerGlReducer.initialState({
      uiState: { currentModal: null },
      mapStyle: { styleType: "osm" },
    }),
  }),
  applyMiddleware(...enhanceReduxMiddleware([])),
);
