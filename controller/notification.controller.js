import Notification from '../models/Notification.js';
import mongoose from 'mongoose';

/** Public / app: only active notifications, newest first */
export const getActiveNotifications = async (req, res) => {
  try {
    const list = await Notification.find({ status: 'active' }).sort({ createdAt: -1 }).lean();
    res.status(200).json(list);
  } catch (err) {
    console.error('getActiveNotifications:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Admin: all notifications, optional ?status=active|inactive */
export const getAllNotificationsAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status === 'active' || status === 'inactive') {
      filter.status = status;
    }
    const list = await Notification.find(filter).sort({ createdAt: -1 }).lean();
    res.status(200).json(list);
  } catch (err) {
    console.error('getAllNotificationsAdmin:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createNotification = async (req, res) => {
  try {
    const { heading, description, content, image, status } = req.body;

    if (!heading || !String(heading).trim()) {
      return res.status(400).json({ message: 'heading is required' });
    }

    const imageUrl =
      image != null && String(image).trim() !== '' ? String(image).trim() : '';

    const doc = await Notification.create({
      heading: String(heading).trim(),
      description: description != null ? String(description) : '',
      content: content != null ? String(content) : '',
      image: imageUrl,
      status: status === 'inactive' ? 'inactive' : 'active',
    });

    res.status(201).json({ message: 'Notification created', notification: doc });
  } catch (err) {
    console.error('createNotification:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification id' });
    }

    const { heading, description, content, image, status } = req.body;
    const update = {};

    if (heading !== undefined) {
      const h = String(heading).trim();
      if (!h) return res.status(400).json({ message: 'heading cannot be empty' });
      update.heading = h;
    }
    if (description !== undefined) update.description = String(description);
    if (content !== undefined) update.content = String(content);
    if (image !== undefined) {
      update.image = image == null || String(image).trim() === '' ? '' : String(image).trim();
    }
    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        return res.status(400).json({ message: 'status must be active or inactive' });
      }
      update.status = status;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const doc = await Notification.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!doc) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({ message: 'Notification updated', notification: doc });
  } catch (err) {
    console.error('updateNotification:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification id' });
    }

    const doc = await Notification.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('deleteNotification:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
