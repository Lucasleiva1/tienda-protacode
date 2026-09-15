import type { Order } from "@/types/order";

/**
 * Puerto de almacenamiento de pedidos.
 *
 * El servicio de pedidos habla con esta interfaz y no con una base de datos concreta.
 * Cuando se elija dónde guardar los pedidos de verdad, se escribe una implementación
 * que cumpla este contrato y no cambia nada del checkout.
 */
export interface OrderRepository {
  readonly name: string;
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  update(order: Order): Promise<void>;
  updateAtomically(
    id: string,
    updater: (current: Order) => Order,
  ): Promise<Order | null>;
}
