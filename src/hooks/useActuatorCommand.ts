import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepositories } from '@/services/repositoryProvider';
import type { ActuatorAction, ActuatorCommand, CommandState } from '@/types';

/**
 * Actuator command lifecycle.
 *
 * Clicking a control does not change any equipment label. The hook reports
 * SENDING, then whatever the device reports, and only reaches CONFIRMED when
 * the backend says the physical device acted.
 */

export const COMMAND_STATE_LABEL: Record<CommandState, string> = {
  IDLE: 'Ready',
  SENDING: 'Sending command',
  ACCEPTED: 'Command accepted',
  WAITING_FOR_DEVICE: 'Waiting for device',
  CONFIRMED: 'Confirmed by device',
  FAILED: 'Command failed',
};

export function useActuatorCommand() {
  const { repositories } = useRepositories();
  const [state, setState] = useState<CommandState>('IDLE');
  const [command, setCommand] = useState<ActuatorCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  const send = useCallback(
    async (params: { farmId: string; zoneId?: string; deviceId: string; action: ActuatorAction }) => {
      unsubscribeRef.current?.();
      setError(null);
      setState('SENDING');
      try {
        const issued = await repositories.irrigation.sendCommand(params);
        setCommand(issued);
        setState('WAITING_FOR_DEVICE');
        unsubscribeRef.current = repositories.irrigation.subscribeToCommand(
          issued.id,
          (next) => {
            setCommand(next);
            setState(next.state);
            if (next.state === 'FAILED') setError(next.failureReason ?? 'The device did not accept the command.');
          },
          (e) => {
            setState('FAILED');
            setError(e.message);
          },
        );
      } catch (e) {
        setState('FAILED');
        setError(e instanceof Error ? e.message : 'The command could not be sent.');
      }
    },
    [repositories],
  );

  const reset = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setState('IDLE');
    setCommand(null);
    setError(null);
  }, []);

  return { send, reset, state, command, error, label: COMMAND_STATE_LABEL[state] };
}
