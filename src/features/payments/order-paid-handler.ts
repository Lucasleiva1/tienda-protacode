import type { Order } from "@/types/order";

/** Punto desacoplado entre una aprobación verificada y la entrega. */
export interface OrderPaidHandler {
  handle(order: Order): Promise<void>;
}

export const noOpOrderPaidHandler: OrderPaidHandler = {
  async handle(order) {
    void order;
  },
};
