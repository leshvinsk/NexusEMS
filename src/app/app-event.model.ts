export interface AppEvent {
    pk_event_id: String;
    event_name: String;
    description: String;
    start_date_time: Date;
    end_date_time: Date;
    files: {
      filename: string,
      data: ArrayBuffer,
      contentType: string
    }[];
    organizer_id?: String; // ID of the event organizer
    ticketTypes?: {
      type: string, // Format: "T-001"
      name: string,
      price: number,
      color: string
    }[];
    discounts?: string[]; // Array of discount IDs in format "D-001"
}