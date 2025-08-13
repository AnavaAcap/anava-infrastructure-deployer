/**
 * Axis Object Analytics (AOA) Module
 * Provides programmatic control of AOA via VAPIX APIs
 */

export { default as AOAService } from './aoaService';
export { default as AOAIntegration } from './aoaIntegration';
export { AOADiscovery } from './aoaDiscovery';
export { AOANaturalLanguageProcessor, deployNLScenario } from './aoaNLProcessor';

export type {
  AOAScenario,
  AOATrigger,
  AOAFilter,
  AOAObjectClassification,
  AOAPerspective,
  AOACapabilities,
  AOAStatus
} from './aoaService';

export type {
  AOADeploymentConfig
} from './aoaIntegration';

export type {
  AOAEndpoint
} from './aoaDiscovery';

export type {
  NLScenarioRequest,
  NLScenarioResponse
} from './aoaNLProcessor';

/**
 * Quick start example:
 * 
 * ```typescript
 * import { AOAService } from './services/aoa';
 * 
 * const aoa = new AOAService('192.168.1.100', 'admin', 'password');
 * 
 * // Start AOA and create human detection scenario
 * await aoa.startAOA();
 * await aoa.createHumanDetectionScenario('Entrance Monitor', 3);
 * 
 * // Or use the integration for deployment
 * import { AOAIntegration } from './services/aoa';
 * 
 * await AOAIntegration.configureAOA(camera, {
 *   enableAOA: true,
 *   scenarios: [{
 *     name: 'Main Entrance',
 *     type: 'motion',
 *     humanDetection: true,
 *     timeInArea: 3
 *   }]
 * });
 * ```
 */