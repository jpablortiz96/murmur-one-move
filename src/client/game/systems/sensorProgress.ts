export type SensorProgressState = {
  used: number;
  maximum: 3;
};

export const createSensorProgressState = (): SensorProgressState => ({ used: 0, maximum: 3 });

export const activateSensorProgress = (state: SensorProgressState): SensorProgressState =>
  state.used >= state.maximum ? state : { ...state, used: state.used + 1 };

export const resetSensorProgress = (): SensorProgressState => createSensorProgressState();
