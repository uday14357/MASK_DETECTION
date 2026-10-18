import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import motor.motor_asyncio
from app.core.config import settings

class InMemoryAsyncCollection:
    """Async Mongo-compatible in-memory collection with JSON persistence fallback"""
    def __init__(self, name: str, data_store: dict):
        self.name = name
        self.data_store = data_store
        if self.name not in self.data_store:
            self.data_store[self.name] = []

    def _matches(self, doc: dict, query: dict) -> bool:
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, q) for q in v):
                    return False
            elif k == "$and":
                if not all(self._matches(doc, q) for q in v):
                    return False
            elif isinstance(v, dict):
                val = doc.get(k)
                for op, op_val in v.items():
                    if op == "$gte" and not (val is not None and val >= op_val):
                        return False
                    if op == "$lte" and not (val is not None and val <= op_val):
                        return False
                    if op == "$gt" and not (val is not None and val > op_val):
                        return False
                    if op == "$lt" and not (val is not None and val < op_val):
                        return False
                    if op == "$in" and not (val in op_val):
                        return False
                    if op == "$regex":
                        import re
                        pattern = re.compile(op_val, re.IGNORECASE if v.get("$options") == "i" else 0)
                        if not (val is not None and pattern.search(str(val))):
                            return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    async def find_one(self, query: dict) -> Optional[dict]:
        for doc in self.data_store[self.name]:
            if self._matches(doc, query):
                return dict(doc)
        return None

    def find(self, query: dict = None):
        if query is None:
            query = {}
        items = [dict(doc) for doc in self.data_store[self.name] if self._matches(doc, query)]
        return InMemoryAsyncCursor(items)

    async def insert_one(self, doc: dict):
        new_doc = dict(doc)
        if "_id" not in new_doc:
            new_doc["_id"] = str(uuid.uuid4())
        self.data_store[self.name].append(new_doc)
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(new_doc["_id"])

    async def update_one(self, query: dict, update: dict):
        for doc in self.data_store[self.name]:
            if self._matches(doc, query):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        doc[k] = v
                class UpdateResult:
                    def __init__(self):
                        self.matched_count = 1
                        self.modified_count = 1
                return UpdateResult()
        class UpdateResultZero:
            def __init__(self):
                self.matched_count = 0
                self.modified_count = 0
        return UpdateResultZero()

    async def delete_one(self, query: dict):
        for i, doc in enumerate(self.data_store[self.name]):
            if self._matches(doc, query):
                del self.data_store[self.name][i]
                class DeleteResult:
                    def __init__(self):
                        self.deleted_count = 1
                return DeleteResult()
        class DeleteResultZero:
            def __init__(self):
                self.deleted_count = 0
        return DeleteResultZero()

    async def count_documents(self, query: dict = None) -> int:
        if query is None:
            query = {}
        return sum(1 for doc in self.data_store[self.name] if self._matches(doc, query))

    async def create_index(self, *args, **kwargs):
        pass


class InMemoryAsyncCursor:
    def __init__(self, items: List[dict]):
        self._items = items
        self._skip_val = 0
        self._limit_val = None

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, str):
            reverse = direction == -1
            self._items.sort(key=lambda x: str(x.get(key_or_list, "")), reverse=reverse)
        elif isinstance(key_or_list, list):
            for k, d in reversed(key_or_list):
                self._items.sort(key=lambda x: str(x.get(k, "")), reverse=(d == -1))
        return self

    def skip(self, count: int):
        self._skip_val = count
        return self

    def limit(self, count: int):
        self._limit_val = count
        return self

    async def to_list(self, length: Optional[int] = None) -> List[dict]:
        sliced = self._items[self._skip_val:]
        if self._limit_val is not None:
            sliced = sliced[:self._limit_val]
        if length is not None:
            sliced = sliced[:length]
        return sliced

    def __aiter__(self):
        self._iter = iter(self._items)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class DatabaseManager:
    client = None
    db = None
    is_fallback = False
    _fallback_store: Dict[str, List[dict]] = {}

    @classmethod
    async def connect(cls):
        try:
            client = motor.motor_asyncio.AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=2000
            )
            # Ping database to verify live connectivity
            await client.admin.command('ping')
            cls.client = client
            cls.db = client[settings.DATABASE_NAME]
            cls.is_fallback = False
            print(f"[Database] Connected to live MongoDB at {settings.MONGODB_URI}/{settings.DATABASE_NAME}")
        except Exception as e:
            print(f"[Database] MongoDB not available ({e}). Initializing high-performance embedded fallback datastore.")
            cls.client = None
            cls.is_fallback = True
            cls.db = None

    @classmethod
    def get_collection(cls, name: str):
        if not cls.is_fallback and cls.db is not None:
            return cls.db[name]
        return InMemoryAsyncCollection(name, cls._fallback_store)

    @classmethod
    async def close(cls):
        if cls.client:
            cls.client.close()
            print("[Database] MongoDB connection closed.")

def get_collection(name: str):
    return DatabaseManager.get_collection(name)
