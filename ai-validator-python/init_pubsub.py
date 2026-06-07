import os
from google.cloud import pubsub_v1
from google.api_core.exceptions import AlreadyExists

project_id = "slashslice"
topic_id = "pizza-slices-events"
subscription_id = "pizza-slices-events-sub"

publisher = pubsub_v1.PublisherClient()
subscriber = pubsub_v1.SubscriberClient()

topic_path = publisher.topic_path(project_id, topic_id)
subscription_path = subscriber.subscription_path(project_id, subscription_id)

try:
    topic = publisher.create_topic(request={"name": topic_path})
    print(f"Created topic: {topic.name}")
except AlreadyExists:
    print(f"Topic {topic_path} already exists.")

try:
    subscription = subscriber.create_subscription(request={"name": subscription_path, "topic": topic_path})
    print(f"Created subscription: {subscription.name}")
except AlreadyExists:
    print(f"Subscription {subscription_path} already exists.")
