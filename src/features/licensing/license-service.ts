import "server-only";

import { timingSafeEqual } from "node:crypto";
import { licenseIdempotencyKey } from "@/features/fulfillment/license-idempotency";
import {
  getLicenseConfiguration,
  getLicenseProvider,
  type LicenseConfiguration,
  type LicenseProvider,
} from "@/lib/licensing";
import type { Order } from "@/types/order";

/**
 * LicenseService: la tienda habla con las licencias a través de esta capa.
 *
 * La asignación la hace la entrega (`FulfillmentService`) con claves de
 * idempotencia estables. Este servicio agrega las consultas que no cambian nada:
 * verificar una licencia asignada y validar una clave. Qué sistema responde lo
 * decide `LICENSE_PROVIDER`; nada de acá depende de sus detalles internos.
 */

export type LicenseVerificationStatus =
  | "match"
  | "mismatch"
  | "not_found"
  | "not_assigned"
  | "unsupported"
  | "error";

export interface LicenseVerification {
  readonly status: LicenseVerificationStatus;
  readonly message: string;
}

export interface LicenseProviderSummary extends LicenseConfiguration {
  readonly implementation: string;
  readonly canLookup: boolean;
  readonly canValidate: boolean;
}

function sameKey(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class LicenseService {
  constructor(
    private readonly provider: LicenseProvider,
    private readonly configuration: () => LicenseConfiguration = getLicenseConfiguration,
  ) {}

  summary(): LicenseProviderSummary {
    return {
      ...this.configuration(),
      implementation: this.provider.name,
      canLookup: typeof this.provider.getLicense === "function",
      canValidate: typeof this.provider.validateLicense === "function",
    };
  }

  async verifyAssignedLicense(order: Order, productId: string): Promise<LicenseVerification> {
    const item = order.items.find((candidate) => candidate.productId === productId);
    if (item === undefined) {
      return { status: "not_found", message: "Ese producto no pertenece al pedido." };
    }
    if (item.licenseStatus === "not_required") {
      return { status: "not_assigned", message: "Este producto se entrega sin licencia." };
    }
    if (item.licenseStatus !== "issued" || item.licenseKey === null) {
      return { status: "not_assigned", message: "Todavía no hay una licencia asignada." };
    }
    if (this.provider.getLicense === undefined) {
      return {
        status: "unsupported",
        message: `El proveedor activo (${this.provider.name}) no permite consultar licencias desde la tienda. Verificala en su panel buscando el pedido.`,
      };
    }

    const lookup = await this.provider.getLicense({
      appId: item.appId,
      orderId: order.id,
      orderReference: order.reference,
      productId: item.productId,
      idempotencyKey: licenseIdempotencyKey(order.id, item.productId),
    });
    if (!lookup.ok) {
      return { status: "error", message: `No se pudo consultar: ${lookup.message} (${lookup.error})` };
    }
    if (!lookup.found) {
      return {
        status: "not_found",
        message: "El sistema de licencias no tiene una licencia registrada para este pedido.",
      };
    }
    if (!sameKey(lookup.license.licenseKey, item.licenseKey)) {
      return {
        status: "mismatch",
        message: "La clave guardada en la tienda NO coincide con la del sistema de licencias.",
      };
    }

    if (this.provider.validateLicense !== undefined) {
      const validation = await this.provider.validateLicense({
        appId: item.appId,
        licenseKey: item.licenseKey,
      });
      if (validation.ok && !validation.valid) {
        return {
          status: "mismatch",
          message: `La clave coincide, pero el sistema de licencias la informa como no válida${validation.status === null ? "" : ` (${validation.status})`}.`,
        };
      }
    }

    return {
      status: "match",
      message: `Coincide con el sistema de licencias (${lookup.license.status}).`,
    };
  }
}

export function createLicenseService(): LicenseService {
  return new LicenseService(getLicenseProvider());
}
