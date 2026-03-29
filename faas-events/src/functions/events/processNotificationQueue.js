exports.handler = async (event) => {
  const records = event?.Records || [];

  for (const record of records) {
    try {
      const message = JSON.parse(record.body || "{}");
      console.log("Notification event consumed", {
        eventType: message.eventType,
        reservationId: message.reservationId,
        userId: message.userId,
      });
    } catch (error) {
      console.error("Failed to parse notification queue message", {
        body: record.body,
        error,
      });
      throw error;
    }
  }

  return {
    consumed: records.length,
  };
};
