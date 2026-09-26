import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { TaskModel } from '../src/models/task.model';

jest.setTimeout(30000);

beforeAll(async () => {
  await connectDatabase();
  // Make sure a previous crashed run cannot leak data into this one.
  await TaskModel.deleteMany({});
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await TaskModel.collection.drop().catch(() => undefined);
  await disconnectDatabase();
});
