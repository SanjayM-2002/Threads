import {
  Avatar,
  Divider,
  Flex,
  Image,
  Skeleton,
  SkeletonCircle,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import React, { useEffect, useRef, useState } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import useShowToast from '../hooks/useShowToast';
import { useRecoilState, useRecoilValue } from 'recoil';
import conversationsAtom from '../atoms/conversationsAtom';
import selectedConversationAtom from '../atoms/selectedConversationAtom';
import userAtom from '../atoms/userAtom';
import { useSocket } from '../context/SocketContext';

const MessageContainer = () => {
  const showToast = useShowToast();
  const currentUser = useRecoilValue(userAtom);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [conversations, setConversations] = useRecoilState(conversationsAtom);
  const [selectedConversation, setSelectedConversation] = useRecoilState(
    selectedConversationAtom
  );
  const [messages, setMessages] = useState([]);
  const { socket } = useSocket();
  const messageEndRef = useRef(null);

  useEffect(() => {
    socket.on('newMessage', (message) => {
      if (selectedConversation._id === message.conversationId) {
        setMessages((prev) => [...prev, message]);
      }

      setConversations((prev) => {
        const updatedConversations = prev.map((conversation) => {
          if (conversation._id === message.conversationId) {
            return {
              ...conversation,
              lastMessage: {
                text: message.text,
                sender: message.sender,
              },
            };
          }
          return conversation;
        });
        return updatedConversations;
      });
    });

    return () => socket.off('newMessage');
  }, [socket, selectedConversation, setConversations]);

  useEffect(() => {
    const lastMessageIsFromOtherUser =
      messages.length &&
      messages[messages.length - 1].sender !== currentUser._id;
    if (lastMessageIsFromOtherUser) {
      socket.emit('markMessagesAsSeen', {
        conversationId: selectedConversation._id,
        userId: selectedConversation.userId,
      });
    }

    socket.on('messagesSeen', ({ conversationId }) => {
      if (selectedConversation._id === conversationId) {
        setMessages((prev) => {
          const updatedMessages = prev.map((message) => {
            if (!message.seen) {
              return {
                ...message,
                seen: true,
              };
            }
            return message;
          });
          return updatedMessages;
        });
      }
    });
  }, [socket, currentUser._id, messages, selectedConversation]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behaviour: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const getMessages = async () => {
      setLoadingMessages(true);
      setMessages([]);
      try {
        if (selectedConversation.dummy) return;
        const res = await fetch(
          `/api/messages/${selectedConversation.userId}`,
          {
            method: 'GET',
          }
        );
        const data = await res.json();
        if (data.error) {
          console.log('Error is: ', data.error);
          showToast('Error', data.error, 'error');
          return;
        }
        console.log('Data from get messages response is: ', data);
        setMessages(data);
      } catch (err) {
        console.log('Err is: ', err);
        showToast('Error', err, 'error');
      } finally {
        setLoadingMessages(false);
      }
    };

    getMessages();
  }, [showToast, selectedConversation.userId]);
  return (
    <>
      <Flex
        flex='70'
        bg={useColorModeValue('gray.200', 'gray.dark')}
        borderRadius={'md'}
        p={2}
        flexDirection={'column'}
      >
        {/*Message Header */}
        <Flex w={'full'} h={12} alignItems={'center'} gap={2}>
          <Avatar
            size={'sm'}
            name={selectedConversation.name}
            src={selectedConversation.userProfilePic}
          />
          <Text display={'flex'} alignItems={'center'} fontWeight={700}>
            {selectedConversation.userName}
            <Image src='/verified.png' w={4} h={4} ml={1} />
          </Text>
        </Flex>

        <Divider />

        {/*Messages */}

        <Flex
          flexDir={'column'}
          gap={4}
          my={4}
          p={2}
          height={'400px'}
          overflowY={'auto'}
        >
          {loadingMessages &&
            [...Array(5)].map((_, i) => (
              <Flex
                key={i}
                gap={2}
                alignItems={'center'}
                p={1}
                borderRadius={'md'}
                alignSelf={i % 2 === 0 ? 'flex-start' : 'flex-end'}
              >
                {i % 2 === 0 && <SkeletonCircle size={17} />}
                <Flex flexDir={'column'} gap={2}>
                  <Skeleton h='8px' w='250px' />
                  <Skeleton h='8px' w='250px' />
                  <Skeleton h='8px' w='250px' />
                </Flex>
                {i % 2 !== 0 && <SkeletonCircle size={7} />}
              </Flex>
            ))}

          {!loadingMessages &&
            messages.map((msg) => (
              <Flex
                key={msg._id}
                flexDirection={'column'}
                ref={
                  messages.length - 1 === messages.indexOf(msg)
                    ? messageEndRef
                    : null
                }
              >
                <Message
                  ownMessage={currentUser._id === msg.sender}
                  message={msg}
                />
              </Flex>
            ))}
        </Flex>
        <MessageInput setMessages={setMessages} />
      </Flex>
    </>
  );
};

export default MessageContainer;
